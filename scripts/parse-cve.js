/**
 * CVE 정보 파싱 및 영향도 분석 스크립트
 *
 * 목적: NVD API 또는 CVE 데이터를 파싱하여 위험도 분석 및 알림 생성
 * 사용처: n8n HTTP Request 노드 → Function 노드에서 호출
 *
 * 데이터 소스:
 * - NVD (National Vulnerability Database): https://services.nvd.nist.gov/rest/json/cves/2.0
 * - CVE Details API
 * - GitHub Security Advisories
 *
 * @input {object} cveData - CVE API 응답 데이터
 * @output {object} 분석된 CVE 정보
 */

// ============================================================
// 1. CVE 데이터 파싱 (NVD API 기준)
// ============================================================

/**
 * NVD API 응답 파싱
 * @param {object} nvdResponse - NVD API JSON 응답
 * @returns {Array} 파싱된 CVE 배열
 */
function parseNVDResponse(nvdResponse) {
  const cves = [];

  // NVD API 2.0 형식
  if (nvdResponse.vulnerabilities && Array.isArray(nvdResponse.vulnerabilities)) {
    nvdResponse.vulnerabilities.forEach(item => {
      const cve = item.cve;

      // 기본 정보 추출
      const cveId = cve.id;
      const description = getDescription(cve.descriptions);
      const published = cve.published;
      const lastModified = cve.lastModified;

      // CVSS 점수 추출
      const cvssData = extractCVSS(cve.metrics);

      // 영향받는 제품 추출
      const affectedProducts = extractAffectedProducts(cve.configurations);

      // 참조 링크
      const references = extractReferences(cve.references);

      // CWE (취약점 유형)
      const weaknesses = extractWeaknesses(cve.weaknesses);

      cves.push({
        cve_id: cveId,
        description: description,
        published_date: published,
        last_modified: lastModified,
        cvss: cvssData,
        severity: cvssData.severity,
        affected_products: affectedProducts,
        references: references,
        weaknesses: weaknesses,
        // 추가 메타데이터
        requires_action: cvssData.score >= 7.0, // CVSS 7.0 이상은 조치 필요
        is_exploited: checkIfExploited(references),
        analyzed_at: new Date().toISOString()
      });
    });
  }

  return cves;
}

/**
 * 설명 추출 (다국어 지원)
 * @param {Array} descriptions - 설명 배열
 * @returns {string} 영문 설명
 */
function getDescription(descriptions) {
  if (!descriptions || !Array.isArray(descriptions)) return '';

  // 영문 설명 우선
  const enDesc = descriptions.find(d => d.lang === 'en');
  if (enDesc) return enDesc.value;

  // 없으면 첫 번째 설명
  return descriptions[0] ? descriptions[0].value : '';
}

/**
 * CVSS 점수 및 심각도 추출
 * @param {object} metrics - CVSS 메트릭
 * @returns {object} CVSS 정보
 */
function extractCVSS(metrics) {
  // CVSS v3.x 우선
  if (metrics.cvssMetricV31 && metrics.cvssMetricV31.length > 0) {
    const cvss = metrics.cvssMetricV31[0].cvssData;
    return {
      version: '3.1',
      score: cvss.baseScore,
      severity: cvss.baseSeverity,
      vector: cvss.vectorString,
      exploitability: metrics.cvssMetricV31[0].exploitabilityScore,
      impact: metrics.cvssMetricV31[0].impactScore
    };
  }

  // CVSS v3.0
  if (metrics.cvssMetricV30 && metrics.cvssMetricV30.length > 0) {
    const cvss = metrics.cvssMetricV30[0].cvssData;
    return {
      version: '3.0',
      score: cvss.baseScore,
      severity: cvss.baseSeverity,
      vector: cvss.vectorString,
      exploitability: metrics.cvssMetricV30[0].exploitabilityScore,
      impact: metrics.cvssMetricV30[0].impactScore
    };
  }

  // CVSS v2 (레거시)
  if (metrics.cvssMetricV2 && metrics.cvssMetricV2.length > 0) {
    const cvss = metrics.cvssMetricV2[0].cvssData;
    return {
      version: '2.0',
      score: cvss.baseScore,
      severity: getSeverityFromV2Score(cvss.baseScore),
      vector: cvss.vectorString,
      exploitability: metrics.cvssMetricV2[0].exploitabilityScore,
      impact: metrics.cvssMetricV2[0].impactScore
    };
  }

  return {
    version: 'N/A',
    score: 0,
    severity: 'UNKNOWN',
    vector: '',
    exploitability: 0,
    impact: 0
  };
}

/**
 * CVSS v2 점수를 심각도로 변환
 * @param {number} score - CVSS v2 점수
 * @returns {string} 심각도
 */
function getSeverityFromV2Score(score) {
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  return 'LOW';
}

/**
 * 영향받는 제품 추출
 * @param {Array} configurations - 설정 정보
 * @returns {Array} 제품 목록
 */
function extractAffectedProducts(configurations) {
  const products = [];

  if (!configurations || !Array.isArray(configurations)) return products;

  configurations.forEach(config => {
    if (config.nodes && Array.isArray(config.nodes)) {
      config.nodes.forEach(node => {
        if (node.cpeMatch && Array.isArray(node.cpeMatch)) {
          node.cpeMatch.forEach(cpe => {
            if (cpe.vulnerable) {
              products.push({
                cpe: cpe.criteria,
                vendor: extractVendor(cpe.criteria),
                product: extractProduct(cpe.criteria),
                version_start: cpe.versionStartIncluding,
                version_end: cpe.versionEndExcluding
              });
            }
          });
        }
      });
    }
  });

  return products;
}

/**
 * CPE에서 벤더 추출
 * @param {string} cpe - CPE 문자열
 * @returns {string} 벤더명
 */
function extractVendor(cpe) {
  // cpe:2.3:a:vendor:product:version:...
  const parts = cpe.split(':');
  return parts.length > 3 ? parts[3] : '';
}

/**
 * CPE에서 제품명 추출
 * @param {string} cpe - CPE 문자열
 * @returns {string} 제품명
 */
function extractProduct(cpe) {
  const parts = cpe.split(':');
  return parts.length > 4 ? parts[4] : '';
}

/**
 * 참조 링크 추출
 * @param {Array} references - 참조 배열
 * @returns {Array} 참조 링크 목록
 */
function extractReferences(references) {
  if (!references || !Array.isArray(references)) return [];

  return references.map(ref => ({
    url: ref.url,
    source: ref.source,
    tags: ref.tags || []
  }));
}

/**
 * CWE (취약점 유형) 추출
 * @param {Array} weaknesses - CWE 배열
 * @returns {Array} CWE 목록
 */
function extractWeaknesses(weaknesses) {
  if (!weaknesses || !Array.isArray(weaknesses)) return [];

  const cweList = [];
  weaknesses.forEach(weakness => {
    if (weakness.description && Array.isArray(weakness.description)) {
      weakness.description.forEach(desc => {
        if (desc.value) {
          cweList.push(desc.value);
        }
      });
    }
  });

  return cweList;
}

/**
 * 실제 익스플로잇 존재 여부 확인
 * @param {Array} references - 참조 링크
 * @returns {boolean} 익스플로잇 존재 여부
 */
function checkIfExploited(references) {
  const exploitKeywords = ['exploit', 'poc', 'metasploit', 'exploit-db'];

  for (let ref of references) {
    const urlLower = ref.url.toLowerCase();
    const tags = (ref.tags || []).map(t => t.toLowerCase());

    // URL이나 태그에 exploit 키워드 포함
    if (exploitKeywords.some(keyword => urlLower.includes(keyword))) {
      return true;
    }

    if (tags.some(tag => exploitKeywords.includes(tag))) {
      return true;
    }
  }

  return false;
}

// ============================================================
// 2. 우선순위 분석
// ============================================================

/**
 * CVE 우선순위 계산
 * @param {object} cve - CVE 데이터
 * @returns {string} 우선순위 (critical/high/medium/low)
 */
function calculatePriority(cve) {
  let score = 0;

  // 1. CVSS 점수 (최대 50점)
  score += cve.cvss.score * 5;

  // 2. 익스플로잇 존재 (30점 추가)
  if (cve.is_exploited) {
    score += 30;
  }

  // 3. 최근 공개 (30일 이내 20점)
  const daysSincePublished = getDaysSince(cve.published_date);
  if (daysSincePublished <= 30) {
    score += 20;
  }

  // 4. 심각도 (CRITICAL 키워드)
  if (cve.cvss.severity === 'CRITICAL') {
    score += 10;
  }

  // 우선순위 결정
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * 날짜로부터 경과일 계산
 * @param {string} dateString - ISO 날짜 문자열
 * @returns {number} 경과일
 */
function getDaysSince(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ============================================================
// 3. 필터링 및 그룹화
// ============================================================

/**
 * 특정 제품 관련 CVE 필터링
 * @param {Array} cves - CVE 배열
 * @param {Array} targetProducts - 관심 제품 목록
 * @returns {Array} 필터링된 CVE
 */
function filterByProducts(cves, targetProducts) {
  return cves.filter(cve => {
    return cve.affected_products.some(product =>
      targetProducts.some(target =>
        product.product.toLowerCase().includes(target.toLowerCase())
      )
    );
  });
}

/**
 * 심각도별 그룹화
 * @param {Array} cves - CVE 배열
 * @returns {object} 심각도별 CVE
 */
function groupBySeverity(cves) {
  return {
    critical: cves.filter(c => c.cvss.severity === 'CRITICAL'),
    high: cves.filter(c => c.cvss.severity === 'HIGH'),
    medium: cves.filter(c => c.cvss.severity === 'MEDIUM'),
    low: cves.filter(c => c.cvss.severity === 'LOW')
  };
}

// ============================================================
// 4. 알림 메시지 생성
// ============================================================

/**
 * Slack 메시지 생성
 * @param {Array} cves - CVE 배열
 * @returns {string} Slack 마크다운 메시지
 */
function generateCVESlackMessage(cves) {
  if (cves.length === 0) {
    return ':white_check_mark: 새로운 CVE가 없습니다.';
  }

  const grouped = groupBySeverity(cves);
  const criticalCount = grouped.critical.length;
  const highCount = grouped.high.length;

  let message = `:warning: *새로운 CVE 탐지*\n\n`;
  message += `*총 ${cves.length}개의 취약점 발견*\n`;
  message += `:red_circle: Critical: ${criticalCount}개\n`;
  message += `:orange_circle: High: ${highCount}개\n\n`;

  // CRITICAL CVE 상세 정보
  if (criticalCount > 0) {
    message += `*:rotating_light: CRITICAL 취약점:*\n`;
    grouped.critical.slice(0, 5).forEach(cve => {
      message += `\n• *${cve.cve_id}* (CVSS: ${cve.cvss.score})\n`;
      message += `  ${cve.description.substring(0, 150)}...\n`;
      if (cve.is_exploited) {
        message += `  :boom: *실제 익스플로잇 존재*\n`;
      }
    });

    if (criticalCount > 5) {
      message += `\n_...외 ${criticalCount - 5}개 더 있음_\n`;
    }
  }

  // HIGH CVE 요약
  if (highCount > 0) {
    message += `\n*HIGH 취약점 (${highCount}개):*\n`;
    grouped.high.slice(0, 3).forEach(cve => {
      message += `• ${cve.cve_id} (${cve.cvss.score})\n`;
    });
  }

  message += `\n_분석 시간: ${new Date().toLocaleString('ko-KR')}_`;

  return message;
}

// ============================================================
// 5. n8n 통합 메인 함수
// ============================================================

/**
 * n8n에서 사용할 CVE 분석 메인 함수
 *
 * 사용법 (n8n Function 노드):
 * ```javascript
 * const apiResponse = $input.first().json; // HTTP Request 결과
 * const result = analyzeCVEData(apiResponse);
 * return result;
 * ```
 */
function analyzeCVEData(nvdResponse, targetProducts = []) {
  try {
    // 1. CVE 파싱
    const cves = parseNVDResponse(nvdResponse);

    // 2. 제품 필터링 (선택사항)
    let filteredCVEs = cves;
    if (targetProducts.length > 0) {
      filteredCVEs = filterByProducts(cves, targetProducts);
    }

    // 3. 우선순위 계산
    filteredCVEs.forEach(cve => {
      cve.priority = calculatePriority(cve);
    });

    // 4. 심각도별 그룹화
    const grouped = groupBySeverity(filteredCVEs);

    // 5. Slack 메시지 생성
    const slackMessage = generateCVESlackMessage(filteredCVEs);

    // 6. 통계
    const statistics = {
      total_cves: filteredCVEs.length,
      critical: grouped.critical.length,
      high: grouped.high.length,
      medium: grouped.medium.length,
      low: grouped.low.length,
      with_exploit: filteredCVEs.filter(c => c.is_exploited).length,
      requires_action: filteredCVEs.filter(c => c.requires_action).length
    };

    return {
      success: true,
      analyzed_at: new Date().toISOString(),
      statistics: statistics,
      cves: filteredCVEs,
      grouped: grouped,
      slack_message: slackMessage,
      // 즉시 조치 필요 목록
      immediate_action: filteredCVEs.filter(c =>
        c.priority === 'critical' && c.requires_action
      )
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// ============================================================
// n8n에서 사용 예시
// ============================================================

/*
// n8n Function 노드 코드:

// 1. NVD API 응답 가져오기
const nvdData = $input.first().json;

// 2. 관심 제품 목록 (선택사항)
const targetProducts = ['apache', 'nginx', 'openssl', 'jenkins'];

// 3. CVE 분석 실행
const result = analyzeCVEData(nvdData, targetProducts);

// 4. 결과 반환
if (result.success) {
  return {
    json: {
      statistics: result.statistics,
      critical_count: result.statistics.critical,
      slack_message: result.slack_message,
      immediate_action_items: result.immediate_action
    }
  };
} else {
  throw new Error(`CVE 분석 실패: ${result.error}`);
}
*/

// Export for n8n
// 위 함수들을 n8n Function 노드에 복사하여 사용

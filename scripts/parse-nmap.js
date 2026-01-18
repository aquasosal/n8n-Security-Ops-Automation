/**
 * Nmap XML 결과 파싱 스크립트
 *
 * 목적: Nmap 스캔 결과(XML)를 파싱하여 n8n에서 활용 가능한 JSON 형태로 변환
 * 사용처: n8n Execute Command 노드 → Function 노드에서 호출
 *
 * @input {string} xmlData - Nmap XML 출력 결과
 * @output {object} 파싱된 호스트 및 포트 정보
 */

// ============================================================
// 1. XML 파싱 함수 (정규표현식 기반 - 외부 라이브러리 불필요)
// ============================================================

/**
 * XML에서 호스트 정보 추출
 * @param {string} xmlData - Nmap XML 결과
 * @returns {Array} 호스트 배열
 */
function parseNmapXML(xmlData) {
  const hosts = [];

  // <host> 태그 단위로 분리
  const hostRegex = /<host[^>]*>([\s\S]*?)<\/host>/g;
  let hostMatch;

  while ((hostMatch = hostRegex.exec(xmlData)) !== null) {
    const hostBlock = hostMatch[1];

    // 호스트 상태 확인 (up/down)
    const stateMatch = /<status\s+state="([^"]+)"/.exec(hostBlock);
    if (!stateMatch || stateMatch[1] !== 'up') {
      continue; // down 상태 호스트는 스킵
    }

    // IP 주소 추출
    const addressMatch = /<address\s+addr="([^"]+)"\s+addrtype="ipv4"/.exec(hostBlock);
    const ip = addressMatch ? addressMatch[1] : 'unknown';

    // 호스트명 추출 (있는 경우)
    const hostnameMatch = /<hostname\s+name="([^"]+)"/.exec(hostBlock);
    const hostname = hostnameMatch ? hostnameMatch[1] : ip;

    // 포트 정보 파싱
    const ports = parsePorts(hostBlock);

    // OS 정보 추출
    const os = parseOS(hostBlock);

    hosts.push({
      ip: ip,
      hostname: hostname,
      state: 'up',
      ports: ports,
      os: os,
      open_ports_count: ports.filter(p => p.state === 'open').length,
      scan_time: new Date().toISOString()
    });
  }

  return hosts;
}

/**
 * 포트 정보 파싱
 * @param {string} hostBlock - 단일 호스트 XML 블록
 * @returns {Array} 포트 정보 배열
 */
function parsePorts(hostBlock) {
  const ports = [];

  // <port> 태그 추출
  const portRegex = /<port\s+protocol="([^"]+)"\s+portid="([^"]+)">([\s\S]*?)<\/port>/g;
  let portMatch;

  while ((portMatch = portRegex.exec(hostBlock)) !== null) {
    const protocol = portMatch[1];
    const portid = portMatch[2];
    const portBlock = portMatch[3];

    // 포트 상태
    const stateMatch = /<state\s+state="([^"]+)"/.exec(portBlock);
    const state = stateMatch ? stateMatch[1] : 'unknown';

    // 서비스 정보
    const serviceMatch = /<service\s+name="([^"]+)"(?:\s+product="([^"]*)")?(?:\s+version="([^"]*)")?/.exec(portBlock);
    const service = serviceMatch ? serviceMatch[1] : 'unknown';
    const product = serviceMatch && serviceMatch[2] ? serviceMatch[2] : '';
    const version = serviceMatch && serviceMatch[3] ? serviceMatch[3] : '';

    // 스크립트 출력 (취약점 정보 등)
    const scriptOutputs = parseScriptOutputs(portBlock);

    ports.push({
      port: parseInt(portid),
      protocol: protocol,
      state: state,
      service: service,
      product: product,
      version: version,
      scripts: scriptOutputs,
      // 위험도 판단 (기본 포트 체크)
      risk_level: assessRisk(portid, service, scriptOutputs)
    });
  }

  return ports;
}

/**
 * OS 정보 파싱
 * @param {string} hostBlock - 호스트 XML 블록
 * @returns {string} OS 정보
 */
function parseOS(hostBlock) {
  const osMatchRegex = /<osmatch\s+name="([^"]+)"\s+accuracy="(\d+)"/;
  const osMatch = osMatchRegex.exec(hostBlock);

  if (osMatch && parseInt(osMatch[2]) > 90) {
    return osMatch[1];
  }

  return 'Unknown';
}

/**
 * NSE 스크립트 출력 파싱
 * @param {string} portBlock - 포트 XML 블록
 * @returns {Array} 스크립트 결과
 */
function parseScriptOutputs(portBlock) {
  const scripts = [];
  const scriptRegex = /<script\s+id="([^"]+)"\s+output="([^"]+)"\/>/g;
  let scriptMatch;

  while ((scriptMatch = scriptRegex.exec(portBlock)) !== null) {
    scripts.push({
      id: scriptMatch[1],
      output: scriptMatch[2]
    });
  }

  return scripts;
}

// ============================================================
// 2. 위험도 평가 로직
// ============================================================

/**
 * 포트 위험도 평가
 * @param {string} port - 포트 번호
 * @param {string} service - 서비스 이름
 * @param {Array} scripts - NSE 스크립트 결과
 * @returns {string} 위험도 (critical/high/medium/low)
 */
function assessRisk(port, service, scripts) {
  // 고위험 포트 (관리 포트, RDP, SSH 등)
  const criticalPorts = ['22', '23', '3389', '5900', '445', '139'];
  if (criticalPorts.includes(port)) {
    return 'critical';
  }

  // 데이터베이스 포트
  const dbPorts = ['3306', '5432', '1433', '27017', '6379'];
  if (dbPorts.includes(port)) {
    return 'high';
  }

  // 취약점 스크립트 탐지
  const vulnKeywords = ['vuln', 'exploit', 'CVE'];
  for (let script of scripts) {
    if (vulnKeywords.some(keyword => script.id.includes(keyword))) {
      return 'critical';
    }
  }

  // 웹 서비스
  if (['80', '443', '8080', '8443'].includes(port)) {
    return 'medium';
  }

  return 'low';
}

// ============================================================
// 3. 통계 및 요약 생성
// ============================================================

/**
 * 스캔 결과 통계 생성
 * @param {Array} hosts - 파싱된 호스트 배열
 * @returns {object} 통계 정보
 */
function generateStatistics(hosts) {
  let totalPorts = 0;
  let openPorts = 0;
  let criticalPorts = 0;
  let highPorts = 0;
  const serviceCount = {};

  hosts.forEach(host => {
    host.ports.forEach(port => {
      totalPorts++;
      if (port.state === 'open') {
        openPorts++;

        // 위험도별 카운트
        if (port.risk_level === 'critical') criticalPorts++;
        else if (port.risk_level === 'high') highPorts++;

        // 서비스별 카운트
        serviceCount[port.service] = (serviceCount[port.service] || 0) + 1;
      }
    });
  });

  return {
    total_hosts: hosts.length,
    total_ports: totalPorts,
    open_ports: openPorts,
    critical_ports: criticalPorts,
    high_ports: highPorts,
    top_services: Object.entries(serviceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([service, count]) => ({ service, count }))
  };
}

// ============================================================
// 4. 알림 메시지 생성 (Slack/Email용)
// ============================================================

/**
 * Slack 마크다운 형식 메시지 생성
 * @param {Array} hosts - 호스트 정보
 * @param {object} stats - 통계 정보
 * @returns {string} Slack 메시지
 */
function generateSlackMessage(hosts, stats) {
  let message = `:robot_face: *Nmap 스캔 완료*\n\n`;
  message += `*총 호스트:* ${stats.total_hosts}대\n`;
  message += `*열린 포트:* ${stats.open_ports}개\n`;
  message += `:red_circle: *Critical:* ${stats.critical_ports}개\n`;
  message += `:orange_circle: *High:* ${stats.high_ports}개\n\n`;

  // 고위험 포트가 있는 경우
  if (stats.critical_ports > 0 || stats.high_ports > 0) {
    message += `*:warning: 주의 필요 호스트:*\n`;
    hosts.forEach(host => {
      const criticalPorts = host.ports.filter(p =>
        p.state === 'open' && (p.risk_level === 'critical' || p.risk_level === 'high')
      );

      if (criticalPorts.length > 0) {
        message += `\n• *${host.hostname}* (${host.ip})\n`;
        criticalPorts.forEach(port => {
          message += `  - Port ${port.port}/${port.protocol}: ${port.service} [${port.risk_level.toUpperCase()}]\n`;
        });
      }
    });
  }

  message += `\n_스캔 시간: ${new Date().toLocaleString('ko-KR')}_`;

  return message;
}

// ============================================================
// 5. n8n 통합 (메인 함수)
// ============================================================

/**
 * n8n Function 노드에서 사용할 메인 함수
 *
 * 사용법 (n8n Function 노드):
 * ```javascript
 * const xmlData = $input.first().json.stdout; // Execute Command 결과
 * const result = parseNmapResult(xmlData);
 * return result;
 * ```
 */
function parseNmapResult(xmlData) {
  try {
    // 1. XML 파싱
    const hosts = parseNmapXML(xmlData);

    // 2. 통계 생성
    const statistics = generateStatistics(hosts);

    // 3. Slack 메시지 생성
    const slackMessage = generateSlackMessage(hosts, statistics);

    // 4. 결과 반환 (n8n에서 사용)
    return {
      success: true,
      scan_time: new Date().toISOString(),
      statistics: statistics,
      hosts: hosts,
      slack_message: slackMessage,
      // 고위험 호스트만 필터링
      critical_hosts: hosts.filter(h =>
        h.ports.some(p => p.state === 'open' && p.risk_level === 'critical')
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

// 1. Execute Command 노드의 결과 가져오기
const nmapOutput = $input.first().json.stdout;

// 2. 파싱 함수 실행
const result = parseNmapResult(nmapOutput);

// 3. 결과 반환
if (result.success) {
  return {
    json: {
      statistics: result.statistics,
      critical_count: result.critical_hosts.length,
      slack_message: result.slack_message,
      full_data: result.hosts
    }
  };
} else {
  throw new Error(`Nmap 파싱 실패: ${result.error}`);
}
*/

// Export for n8n (Function 노드에서 직접 복사해서 사용)
// n8n은 모듈 시스템을 지원하지 않으므로, 위 함수들을 Function 노드에 직접 복사하여 사용

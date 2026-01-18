/**
 * HTML 보안 리포트 생성기
 * Nmap, SSLScan, JS Scanner 결과를 하나의 HTML로 통합
 */

function generateSecurityReport(nmapData, sslscanData, jsScannerData) {
  const timestamp = new Date().toLocaleString('ko-KR');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>보안 스캔 리포트</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 15px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 32px;
      margin-bottom: 10px;
    }
    .header .timestamp {
      opacity: 0.9;
      font-size: 14px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      padding: 30px;
      background: #f8f9fa;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-card .icon {
      font-size: 40px;
      margin-bottom: 10px;
    }
    .stat-card .title {
      font-size: 14px;
      color: #6c757d;
      margin-bottom: 5px;
    }
    .stat-card .value {
      font-size: 28px;
      font-weight: bold;
      color: #2c3e50;
    }
    .section {
      padding: 30px;
      border-bottom: 1px solid #e9ecef;
    }
    .section:last-child {
      border-bottom: none;
    }
    .section-title {
      font-size: 24px;
      margin-bottom: 20px;
      color: #2c3e50;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .findings {
      display: grid;
      gap: 15px;
    }
    .finding {
      background: #f8f9fa;
      padding: 15px 20px;
      border-radius: 8px;
      border-left: 4px solid #dee2e6;
    }
    .finding.critical {
      border-left-color: #dc3545;
      background: #fff5f5;
    }
    .finding.high {
      border-left-color: #fd7e14;
      background: #fff8f0;
    }
    .finding.medium {
      border-left-color: #ffc107;
      background: #fffbf0;
    }
    .finding.low {
      border-left-color: #28a745;
      background: #f0fff4;
    }
    .finding-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .finding-title {
      font-weight: bold;
      font-size: 16px;
    }
    .badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .badge.critical { background: #dc3545; color: white; }
    .badge.high { background: #fd7e14; color: white; }
    .badge.medium { background: #ffc107; color: #000; }
    .badge.low { background: #28a745; color: white; }
    .finding-details {
      font-size: 14px;
      color: #6c757d;
      line-height: 1.6;
    }
    .no-findings {
      text-align: center;
      padding: 40px;
      color: #6c757d;
      font-size: 18px;
    }
    .no-findings .icon {
      font-size: 60px;
      margin-bottom: 15px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #dee2e6;
    }
    th {
      background: #f8f9fa;
      font-weight: 600;
      color: #495057;
    }
    tr:hover {
      background: #f8f9fa;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔒 통합 보안 스캔 리포트</h1>
      <div class="timestamp">⏰ ${timestamp}</div>
    </div>

    <div class="stats">
      <div class="stat-card">
        <div class="icon">🔍</div>
        <div class="title">Nmap 스캔</div>
        <div class="value">${nmapData.stats.open_ports}</div>
        <div class="title">열린 포트</div>
      </div>
      <div class="stat-card">
        <div class="icon">🔐</div>
        <div class="title">SSL 취약점</div>
        <div class="value">${sslscanData.vulnerabilities}</div>
        <div class="title">발견</div>
      </div>
      <div class="stat-card">
        <div class="icon">🔑</div>
        <div class="title">시크릿 노출</div>
        <div class="value">${jsScannerData.secrets_found}</div>
        <div class="title">발견</div>
      </div>
    </div>

    <!-- Nmap 섹션 -->
    <div class="section">
      <div class="section-title">
        <span>🔍</span>
        <span>포트 스캔 결과 (Nmap)</span>
      </div>
      ${generateNmapSection(nmapData)}
    </div>

    <!-- SSLScan 섹션 -->
    <div class="section">
      <div class="section-title">
        <span>🔐</span>
        <span>SSL/TLS 분석 (SSLScan)</span>
      </div>
      ${generateSSLSection(sslscanData)}
    </div>

    <!-- JS Scanner 섹션 -->
    <div class="section">
      <div class="section-title">
        <span>🔑</span>
        <span>시크릿 스캔 (JavaScript Scanner)</span>
      </div>
      ${generateJSSection(jsScannerData)}
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

function generateNmapSection(nmapData) {
  if (nmapData.stats.critical_ports === 0 && nmapData.stats.high_ports === 0) {
    return `
      <div class="no-findings">
        <div class="icon">✅</div>
        <div>위험 포트가 발견되지 않았습니다</div>
      </div>
    `;
  }

  let html = '<div class="findings">';

  nmapData.hosts.forEach(host => {
    const dangerPorts = host.ports.filter(p =>
      p.state === 'open' && ['critical', 'high'].includes(p.risk_level)
    );

    dangerPorts.forEach(port => {
      html += `
        <div class="finding ${port.risk_level}">
          <div class="finding-header">
            <div class="finding-title">
              ${host.ip}:${port.port}/${port.protocol}
            </div>
            <span class="badge ${port.risk_level}">${port.risk_level}</span>
          </div>
          <div class="finding-details">
            <strong>서비스:</strong> ${port.service}
            ${port.product ? `<br><strong>제품:</strong> ${port.product}` : ''}
          </div>
        </div>
      `;
    });
  });

  html += '</div>';
  return html;
}

function generateSSLSection(sslscanData) {
  if (sslscanData.vulnerabilities === 0) {
    return `
      <div class="no-findings">
        <div class="icon">✅</div>
        <div>SSL/TLS 취약점이 발견되지 않았습니다</div>
      </div>
    `;
  }

  let html = '<div class="findings">';

  sslscanData.findings.forEach(finding => {
    html += `
      <div class="finding ${finding.severity}">
        <div class="finding-header">
          <div class="finding-title">${finding.title}</div>
          <span class="badge ${finding.severity}">${finding.severity}</span>
        </div>
        <div class="finding-details">${finding.description}</div>
      </div>
    `;
  });

  html += '</div>';
  return html;
}

function generateJSSection(jsScannerData) {
  if (jsScannerData.secrets_found === 0) {
    return `
      <div class="no-findings">
        <div class="icon">✅</div>
        <div>노출된 시크릿이 발견되지 않았습니다</div>
      </div>
    `;
  }

  let html = '<table>';
  html += '<thead><tr><th>파일</th><th>타입</th><th>라인</th><th>심각도</th></tr></thead>';
  html += '<tbody>';

  jsScannerData.secrets.forEach(secret => {
    html += `
      <tr>
        <td>${secret.file}</td>
        <td>${secret.type}</td>
        <td>${secret.line}</td>
        <td><span class="badge ${secret.severity}">${secret.severity}</span></td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  return html;
}

// Export for n8n
module.exports = { generateSecurityReport };

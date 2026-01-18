# Security Automation with n8n

> Telegram 봇 명령어로 **전체 포트 스캔(1-65535)**을 자동화한 n8n 시스템

## 🎯 핵심 기능

### Telegram Bot으로 어디서나 포트 스캔

```
전통적인 방식:
1. 서버에 SSH 접속
2. nmap 명령어 입력
3. 30분 대기
4. 결과 복사/저장
```

```
자동화된 방식:
1. Telegram에서 "/scan 192.168.1.10" 전송
2. 끝! (결과는 자동으로 Telegram 전송)
```

**핵심 개선**: 언제 어디서나 모바일로 전체 포트 스캔 실행 가능 🚀

## 🏗️ Architecture

```
┌─────────────────┐
│   Telegram      │ /scan 192.168.1.10
│   User          │
└────────┬────────┘
         │
┌────────▼────────┐
│ n8n Polling     │ 30초마다 메시지 확인
│ (30s interval)  │
└────────┬────────┘
         │
┌────────▼────────┐
│ Nmap Full Scan  │ TCP 1-65535 (10-30분)
│ (nmap -sS -p-)  │
└────────┬────────┘
         │
┌────────▼────────┐
│ Parse Results   │ 위험도 분석
│ (parse-nmap.js) │ (Critical/High/Medium)
└────────┬────────┘
         │
┌────────▼────────┐
│ Send Telegram   │ 자동 결과 전송
│ Message         │
└─────────────────┘
```

## 📂 프로젝트 구조

```
security-automation-n8n/
├── telegram-bot-template.json         # 🤖 메인 워크플로우 (권장)
├── complete-security-workflow-simple.json  # 통합 스캐너 (Nmap + SSL + JS)
├── scripts/
│   ├── parse-nmap.js                  # Nmap XML → JSON 파싱
│   └── generate-report-html.js        # HTML 리포트 생성
├── TELEGRAM_SETUP.md                  # 📱 Telegram 봇 설정 가이드
└── README.md
```

## 🚀 빠른 시작 (5분)

### 1. Docker로 n8n 설치

```bash
# n8n 실행
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -v n8n_data:/home/node/.n8n \
  n8nio/n8n

# Nmap 설치
docker exec -u root n8n apk add nmap
```

### 2. Telegram Bot 생성

📱 **[TELEGRAM_SETUP.md](TELEGRAM_SETUP.md)** 가이드 참고

1. @BotFather에서 봇 생성 → 토큰 받기
2. 봇과 대화 시작
3. 완료!

### 3. n8n 워크플로우 설정

1. n8n 접속: `http://localhost:5678`
2. **telegram-bot-template.json** import
3. `YOUR_TELEGRAM_BOT_TOKEN`을 실제 토큰으로 교체
4. 워크플로우 활성화

### 4. 사용

```
/scan localhost          # 로컬 스캔
/scan 192.168.1.10      # IP 스캔
/scan example.com       # 도메인 스캔
/help                   # 도움말
```

## 💻 코드 예시

### Nmap 결과 파싱

```javascript
// 위험도 평가 로직
function assessRisk(port, service) {
  const criticalPorts = ['22', '23', '3389', '5900']; // SSH, Telnet, RDP
  if (criticalPorts.includes(port)) return 'critical';

  const dbPorts = ['3306', '5432', '1433', '27017']; // MySQL, PostgreSQL 등
  if (dbPorts.includes(port)) return 'high';

  return 'medium';
}
```

### Telegram 메시지 예시

```
보안 스캔 완료
대상: 192.168.1.10
시간: 2026-01-18 오후 4:23

Nmap 결과
열린 포트: 12개
Critical: 2개
High: 3개
Medium: 7개

총 5개 보안 이슈 발견

위험 포트:
192.168.1.10:
  🔴 22/tcp - ssh
  🔴 3389/tcp - ms-wbt-server
  🟠 3306/tcp - mysql
```

## 🛠️ 기술 스택

- **n8n**: 워크플로우 자동화
- **Nmap**: 전체 TCP 포트 스캔 (1-65535)
- **Telegram Bot API**: 명령어 인터페이스
- **JavaScript**: 결과 파싱 및 위험도 분석
- **Docker**: 컨테이너 환경

## 📊 개선 효과

| 항목 | Before | After |
|------|--------|-------|
| 접근성 | SSH 서버 접속 필요 | Telegram으로 어디서나 |
| 명령어 | 복잡한 nmap 옵션 | `/scan <IP>` |
| 대기 시간 | 터미널 앞 대기 | 무인 자동 실행 |
| 결과 확인 | 터미널만 | Telegram 자동 전송 |

## 🚧 개발 중인 기능

### CVE 자동 검사 (업데이트 예정)

Nmap 포트 스캔 결과를 기반으로 취약점을 자동 검사하는 기능을 개발 중입니다:

**개발 계획:**
1. **서비스 버전 탐지**: `nmap -sV` 옵션으로 실행 중인 서비스의 정확한 버전 식별
2. **CVE 데이터베이스 연동**: 탐지된 서비스/버전 정보로 NVD API 또는 CVE 데이터베이스 검색
3. **통합 리포트**: 포트 스캔 결과 + 관련 취약점 정보를 하나의 Telegram 메시지로 전송

**예상 결과 메시지:**
```
보안 스캔 완료
대상: 192.168.1.10

Nmap 결과:
  🔴 22/tcp - OpenSSH 7.4

취약점 정보:
  ⚠️ CVE-2023-38408 (High)
  - OpenSSH 7.4에서 원격 코드 실행 가능
  - 패치: OpenSSH 9.3p2 이상으로 업그레이드 권장
```

## 🔐 보안 고려사항

- **API 키 관리**: n8n Credentials 암호화 저장
- **스캔 권한**: 인가된 네트워크에서만 실행
- **로그 관리**: 민감 정보 필터링

## 📝 라이선스

이 프로젝트는 보안 자동화 학습 및 실무 적용 목적으로 제공됩니다.

**면책조항**: 이 도구는 인가된 시스템에서만 사용하세요. 무단 스캔은 법적 책임을 질 수 있습니다.

## 📧 문의

프로젝트 관련 문의: [GitHub Issues](https://github.com/aquasosal/n8n-Security-Ops-Automation/issues)

---

**Made with ❤️ for Security Automation**

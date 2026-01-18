# Telegram 봇 설정 가이드 (5분 완성)

## 1단계: Telegram Bot 생성

1. **Telegram 앱에서 @BotFather 검색**
   - 대화 시작

2. **Bot 생성 명령어 입력**
   ```
   /newbot
   ```

3. **Bot 이름 입력** (예시)
   ```
   Security Scanner Bot
   ```

4. **Bot Username 입력** (고유해야 함, 반드시 'bot'으로 끝나야 함)
   ```
   my_security_scanner_bot
   ```

5. **Token 복사하기**
   - BotFather가 다음과 같은 메시지를 보냅니다:
   ```
   Done! Congratulations on your new bot.
   You will find it at t.me/my_security_scanner_bot

   Use this token to access the HTTP API:
   123456789:ABCdefGHIjklMNOpqrsTUVwxyz-1234567
   ```
   - 이 Token을 복사해두세요! ⭐

## 2단계: Chat ID 얻기

1. **생성한 봇과 대화 시작**
   - t.me/my_security_scanner_bot 접속
   - `/start` 입력하고 아무 메시지나 전송 (예: "테스트")

2. **브라우저에서 아래 URL 접속** (Token 부분을 본인 Token으로 교체)
   ```
   https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz-1234567/getUpdates
   ```

3. **Chat ID 찾기**
   - 응답 JSON에서 `"chat":{"id":123456789}` 부분 찾기
   - 숫자가 Chat ID입니다 (예: `123456789`)

## 3단계: n8n에 Credential 등록

1. **n8n 웹 인터페이스 접속**
   ```
   http://localhost:5678
   ```

2. **Credential 추가**
   - 우측 상단 메뉴 (설정 아이콘) → **Credentials** → **New**
   - "Telegram" 검색 후 선택

3. **Access Token 입력**
   - 1단계에서 복사한 Token 붙여넣기
   - Name: "Telegram Bot" (또는 원하는 이름)
   - **Save** 클릭

## 4단계: Workflow에 Chat ID 설정

### 방법 1: 환경 변수 사용 (권장)

1. **n8n 컨테이너에 환경 변수 추가**
   ```bash
   docker stop n8n
   docker rm n8n

   docker run -d \
     --name n8n \
     -p 5678:5678 \
     -e TELEGRAM_CHAT_ID=123456789 \
     -v n8n_data:/home/node/.n8n \
     n8nio/n8n
   ```

2. **워크플로우는 그대로 사용**
   - `{{ $env.TELEGRAM_CHAT_ID }}`가 자동으로 치환됩니다

### 방법 2: 워크플로우에 직접 입력

1. **production-workflow-telegram.json Import**
2. **Telegram 노드 2개 열기** (🚨 Telegram 경고, ✅ Telegram 정상)
3. **Chat ID 필드에 직접 입력**
   - `{{ $env.TELEGRAM_CHAT_ID }}` 삭제
   - 본인의 Chat ID 입력 (예: `123456789`)

## 5단계: 테스트

1. **워크플로우 실행**
   - n8n에서 "Test workflow" 클릭

2. **Telegram 확인**
   - 봇으로부터 메시지가 도착해야 합니다!

## 예상 메시지 형식

### 🔴 위험 포트 발견 시
```
🚨 보안 경고 발생!

🔍 Nmap 보안 스캔 완료

📊 통계
• 스캔 호스트: 1대
• 전체 포트: 7개
• 열린 포트: 2개
🔴 Critical: 0개
🟠 High: 0개
🟡 Medium: 2개

⏰ 2026-01-18 15:30:45
```

### ✅ 정상 스캔 시
```
🔍 Nmap 보안 스캔 완료

📊 통계
• 스캔 호스트: 1대
• 전체 포트: 7개
• 열린 포트: 1개
🔴 Critical: 0개
🟠 High: 0개
🟡 Medium: 1개

✅ 위험 포트가 발견되지 않았습니다.

⏰ 2026-01-18 15:30:45
```

## 문제 해결

### "Unauthorized" 에러
- Token이 올바른지 확인
- BotFather에서 받은 전체 Token을 복사했는지 확인

### 메시지가 오지 않음
- Chat ID가 올바른지 확인
- 봇과 먼저 대화를 시작했는지 확인 (`/start` 전송)
- n8n 실행 로그 확인: `docker logs n8n`

### "Chat not found" 에러
- `/start` 명령어를 봇에게 먼저 전송해야 합니다
- getUpdates API 호출 전에 봇과 대화를 시작해야 합니다

## 장점 요약

✅ OAuth 설정 불필요
✅ 워크스페이스 가입 필요 없음
✅ 개인 메시지로 즉시 수신
✅ 모바일 알림 지원
✅ 설정 시간 5분 이내

---

**다음 단계**: [README.md](README.md)로 돌아가서 전체 프로젝트 구조 확인

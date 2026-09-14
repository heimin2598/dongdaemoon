# Maestro UI 자동화

DDM Sherpa Android UI/UX 회귀 검증용 Maestro 플로우.

## 사전 조건
- Maestro CLI 설치 위치: `C:\Users\1\maestro\maestro\bin\maestro.bat`
- JDK 21 (Android Studio 번들): `C:\Program Files\Android\Android Studio\jbr`
- Android 에뮬레이터 부팅: `C:\Users\1\AppData\Local\Android\Sdk\emulator\emulator.exe -avd Pixel_7`
- 앱 빌드/설치: `JAVA_HOME=...JDK21 npx expo run:android` (최초 1회, 이후 변경 시 재빌드)

> **JDK 주의**: 시스템 기본 JDK 가 25 면 Gradle 8.x 에러. JDK 21 (Android Studio 번들) 사용 필수.

## 실행

JAVA_HOME 자동 설정되는 `run.bat` 사용 권장:

```bash
# 단일 플로우
maestro/run.bat maestro/flows/smoke_login.yaml

# 디렉터리 전체 (순차)
maestro/run.bat maestro/flows/
```

또는 직접:

```bash
"C:/Users/1/maestro/maestro/bin/maestro.bat" test maestro/flows/smoke_login.yaml
```

## 플로우 목록
- `smoke_login.yaml` — 타이틀 → 로그인 화면 진입 (스모크)
- `chat_keyboard.yaml` — 로그인 → 채팅 입장 → 키보드 열림 시 입력바 위치 스크린샷 캡처

## 회귀 체크 흐름
변경 후:
1. `expo run:android` 로 변경 반영
2. Maestro 플로우 실행
3. 스크린샷이 정상인지 육안 확인 (`~/.maestro/screenshots`)
4. 최종 확인은 Expo Go on 실기기

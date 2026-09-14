# 로컬 Production AAB 빌드 가이드

EAS 무료 빌드 쿼터 초과 시 또는 빠른 검증을 위해 로컬에서 서명된 production AAB 를 만드는 방법.

## 필요 환경

- Java 21 (Android Studio JBR 권장: `C:\Program Files\Android\Android Studio\jbr`)
- Android SDK
- EAS CLI (`npm install -g eas-cli`)
- 인터넷 연결 (첫 회 키스토어 다운로드용)

---

## 단계

### 1. EAS 키스토어 다운로드 (최초 1회만)

대화형 CLI 라 사용자가 직접 실행해야 합니다.

```powershell
cd C:\VSCODE\DONGDAEMOON
eas credentials --platform android
```

CLI 가 묻는 항목:
1. **Which build profile** → `production`
2. **What do you want to do?** → `Keystore: Manage everything needed to build your project`
3. **Select an action** → `Download existing keystore`
4. **Save path** → `android/keystores/release.jks` (디렉터리 미리 생성: `mkdir android\keystores`)

다운로드 완료 후 CLI 가 출력하는 다음 4개 값을 메모:
- Keystore Password
- Key Alias
- Key Password
- Keystore SHA1 fingerprint (Play Console 확인용)

### 2. android/keystore.properties 생성

```properties
storeFile=keystores/release.jks
storePassword=<step1 의 Keystore Password>
keyAlias=<step1 의 Key Alias>
keyPassword=<step1 의 Key Password>
```

> ⚠️ 이 파일은 `.gitignore` 에 등록되어 있어야 함 (현재 등록됨).

### 3. android/app/build.gradle 의 release signingConfig 수정

기존:
```gradle
signingConfigs {
    debug {
        storeFile file('debug.keystore')
        ...
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.debug   // ← 변경 대상
        ...
    }
}
```

수정 후:
```gradle
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

signingConfigs {
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
    release {
        if (keystorePropertiesFile.exists()) {
            storeFile rootProject.file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        ...
    }
}
```

> ⚠️ `npx expo prebuild` 시 build.gradle 이 재생성될 수 있음. patch 를 plugin 으로 영구화하려면 `expo-build-properties` 또는 별도 config plugin 사용.

### 4. versionCode 증가

`app.json` 의 `android.versionCode` 가 자동 증가 안 됨 (EAS 의 autoIncrement 사용 안 함). 수동으로 +1.

또는 `eas.json` 의 `production.autoIncrement: true` 가 작동하려면 EAS Build 사용 필요. 로컬 빌드 시엔 수동 관리.

### 5. 빌드 실행

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
cd C:\VSCODE\DONGDAEMOON
npx expo prebuild --platform android
cd android
.\gradlew bundleRelease
```

(Git Bash 의 경우:)
```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export PATH="$JAVA_HOME/bin:$PATH"
cd /c/VSCODE/DONGDAEMOON
npx expo prebuild --platform android
cd android
./gradlew bundleRelease
```

빌드 시간: 약 10-15분. 결과물:
```
C:\VSCODE\DONGDAEMOON\android\app\build\outputs\bundle\release\app-release.aab
```

### 6. Play Console 업로드

- Play Console → 비공개 테스트 → 출시 만들기 → app-release.aab 업로드
- 검토 자동 시작 (수 시간 ~ 1일)

---

## 트러블슈팅

### Java 25 사용 시 `Error resolving plugin [id: 'com.facebook.react.settings']`
- 원인: Gradle 8.14 + RN 0.81 은 Java 25 미지원
- 해결: JAVA_HOME 을 Java 21 로 설정 (Android Studio JBR 이용)

### Gradle 빌드 멈춤 (`:app:installDebug` 무한 대기)
- 원인: adb 데몬 충돌
- 해결: 
  ```bash
  netstat -ano | grep 5037   # adb server PID 찾기
  taskkill /F /PID <PID>     # 죽이기
  adb start-server           # 재시작
  ```

### `eas credentials` 한국어 깨짐
- 별 문제 없음. CLI 가 영어 위주. 안내 메시지가 일부 한글이라면 Windows Terminal UTF-8 설정.

---

## 키 분실 방지

EAS 에 저장된 release.jks 가 유일한 서명 키입니다. **이걸 분실하면 Play Store 에서 같은 앱 업데이트가 영원히 불가**합니다 (새 앱으로 재출시해야 함).

- ✅ EAS 클라우드 (자동 백업 — 계정 살아있는 한 안전)
- ✅ 로컬 다운로드 후 1Password / Bitwarden / iCloud Drive 등 안전한 곳에 추가 복사

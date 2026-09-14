#!/bin/bash
# 로컬 production AAB 빌드 — Git Bash 용
# 사전 조건: android/keystore.properties + android/keystores/release.jks 준비 완료

set -e
cd "$(dirname "$0")/.."

if [ ! -f android/keystore.properties ]; then
  echo "ERROR: android/keystore.properties 가 없습니다."
  echo ""
  echo "다음 명령으로 keystore 를 먼저 다운로드하세요:"
  echo "  eas credentials --platform android"
  echo "  → production 프로필 → Keystore → Download existing keystore"
  echo "  → android/keystores/release.jks 로 저장"
  echo ""
  echo "그 다음 android/keystore.properties 를 다음 형식으로 작성:"
  echo "  storeFile=keystores/release.jks"
  echo "  storePassword=<from eas output>"
  echo "  keyAlias=<from eas output>"
  echo "  keyPassword=<from eas output>"
  exit 1
fi

export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
export PATH="$JAVA_HOME/bin:$PATH"

echo "[1/3] expo prebuild..."
npx expo prebuild --platform android

echo "[2/3] gradle bundleRelease..."
cd android
./gradlew bundleRelease

echo ""
echo "✅ 빌드 완료"
ls -lh app/build/outputs/bundle/release/*.aab
echo ""
echo "Play Console 업로드:"
echo "  https://play.google.com/console → 비공개 테스트 → 출시 만들기 → 위 .aab 업로드"

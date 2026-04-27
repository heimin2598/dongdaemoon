# Assets

## 필수 이미지 (배포 전 교체)
아래 파일명은 `app.json`에서 참조됩니다. 실제 아이콘/스플래시로 교체 후 커밋하세요.

- `images/icon.png` (1024×1024, iOS 앱 아이콘)
- `images/adaptive-icon.png` (1024×1024, Android adaptive icon foreground)
- `images/splash.png` (1284×2778 권장, 스플래시 이미지)
- `images/favicon.png` (48×48, 웹용)

개발 중에는 placeholder로 두고 실제 아이콘 작업 후 교체하면 됩니다.

## 지도 원본 참조 이미지
`maps/raw_reference/` 폴더에 동대문 종합시장 층별 원본 지도가 들어 있습니다.
이 이미지는 **앱 번들에 직접 사용하지 않고**, 코드 내 도형 데이터(`src/data/maps/*.ts`) 를 만들 때 기준 자료로만 사용합니다.

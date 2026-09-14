/**
 * 기능 플래그 — 출시 단계에 따라 일부 기능을 일시적으로 비활성화.
 * 정식 오픈 준비되면 true 로 변경 후 새 빌드.
 */

/** 1:1 메신저. false 이면 모든 진입점에 "준비중" 안내 표시. */
export const FEATURE_MESSENGER_ENABLED = false;

/** 메신저 비활성 시 사용자에게 보여줄 메시지. */
export const MESSENGER_COMING_SOON_TITLE = '메신저 준비 중';
export const MESSENGER_COMING_SOON_BODY =
  '1:1 메신저 기능은 매장 사장님들의 정식 가입 절차가 마무리되는 대로 오픈됩니다. 빠른 시일 내에 사용하실 수 있도록 준비하고 있습니다. 조금만 기다려 주세요!';

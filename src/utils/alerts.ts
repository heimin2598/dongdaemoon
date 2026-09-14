import { Alert, Platform } from 'react-native';

/** 단일 확인 버튼이 있는 안내 알림. 웹/네이티브 모두 동작. */
export function showInfoAlert(
  title: string,
  message: string,
  onConfirm?: () => void,
  confirmLabel = '확인',
): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    }
    onConfirm?.();
    return;
  }
  Alert.alert(title, message, [{ text: confirmLabel, onPress: onConfirm }]);
}

/** 확인/취소 두 버튼 다이얼로그. 웹/네이티브 모두 동작.
 *  Why: 웹에서 RN Alert.alert 는 다중 버튼 onPress 콜백을 호출하지 않아 destructive 액션이 무시됨. */
export function showConfirmAlert(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: {
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onCancel?: () => void;
  },
): void {
  const { confirmLabel = '확인', cancelLabel = '취소', destructive = false, onCancel } = options ?? {};
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    } else {
      onCancel?.();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel', onPress: onCancel },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

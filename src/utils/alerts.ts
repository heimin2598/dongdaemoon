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

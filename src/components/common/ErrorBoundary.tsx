import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';

interface Props {
  children: React.ReactNode;
  fallback?: (err: Error, reset: () => void) => React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>⚠️</Text>
        <Text style={styles.title}>문제가 발생했습니다</Text>
        <Text style={styles.desc}>
          화면을 그리는 중 예상치 못한 오류가 발생했어요. 다시 시도해 주세요.
        </Text>
        {__DEV__ && (
          <Text style={styles.dev} numberOfLines={4}>
            {error.message}
          </Text>
        )}
        <Pressable style={styles.button} onPress={this.reset}>
          <Text style={styles.buttonText}>다시 시도</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: Colors.background,
  },
  emoji: { fontSize: 42, marginBottom: 18 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  desc: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  dev: {
    marginTop: 16,
    padding: 10,
    backgroundColor: '#2A2A2E',
    color: '#FFB9B9',
    borderRadius: 8,
    fontSize: 11,
    fontFamily: 'Courier',
  },
  button: {
    marginTop: 24,
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '700' },
});

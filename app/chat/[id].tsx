import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Check, ImageIcon, Languages, Send, Video as VideoIcon, X } from 'lucide-react-native';
import { translateText } from '@/lib/translate';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/i18n';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import {
  sendImageMessage,
  sendTextMessage,
  sendVideoMessage,
  subscribeChat,
  subscribeMessages,
} from '@/lib/chats';
import { showInfoAlert } from '@/utils/alerts';
import type { Chat, ChatMessage } from '@/types';

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = String(id ?? '');
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const { i18n, t } = useTranslation();
  const myLang = (i18n.language as AppLanguage) || 'ko';
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  // 메시지별 번역 캐시: messageId → translated text. null = 번역중. undefined = 미번역
  const [translations, setTranslations] = useState<Record<string, string | null>>({});
  // 메시지별 감지된 원문 언어 코드 (DeepL: 'KO'|'EN'|'JA'|'ZH'|...)
  const [sourceLangs, setSourceLangs] = useState<Record<string, string>>({});
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  // 채팅별 자동 번역 설정 — null 이면 OFF, AppLanguage 면 그 언어로 받은 메시지 자동 번역
  const [autoTargetLang, setAutoTargetLang] = useState<AppLanguage | null>(null);
  const [translateSheetOpen, setTranslateSheetOpen] = useState(false);

  // AsyncStorage 키: chat 별로 저장 → 같은 채팅 재진입 시 설정 유지.
  // 디폴트: 앱 언어가 한국어면 OFF (대부분 한국어 대화), 외국어면 그 언어로 ON.
  // 사용자가 명시 변경하면 그것 우선.
  const storageKey = chatId ? `chat-translate-${chatId}` : null;
  useEffect(() => {
    if (!storageKey) return;
    AsyncStorage.getItem(storageKey).then((v) => {
      if (v === 'off') setAutoTargetLang(null);
      else if (v === 'ko' || v === 'en' || v === 'ja' || v === 'zh-Hans') setAutoTargetLang(v);
      else setAutoTargetLang(myLang === 'ko' ? null : myLang); // 한국어 사용자는 끄기 디폴트
    });
  }, [storageKey, myLang]);
  const saveAutoTarget = (lang: AppLanguage | null) => {
    setAutoTargetLang(lang);
    // 언어 변경 시 캐시 reset — 이전 언어로 번역된 결과를 그대로 두면
    // 새 언어로 재요청 안 됨. sourceLangs 도 같이 reset.
    setTranslations({});
    setSourceLangs({});
    setTranslateSheetOpen(false);
    if (storageKey) {
      AsyncStorage.setItem(storageKey, lang ?? 'off');
    }
  };
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const sub1 = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const sub2 = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);

  useEffect(() => {
    if (!chatId) return;
    const unsub1 = subscribeChat(chatId, setChat);
    const unsub2 = subscribeMessages(chatId, (msgs) => {
      setMessages(msgs);
      // 자동 스크롤
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [chatId]);

  // 자동 번역 모드 — 받은 메시지(상대가 보낸 text) 를 autoTargetLang 으로 일괄 번역.
  // 이미 처리 중/완료된 메시지는 functional setState 로 skip (translations 를 deps 에 넣으면 무한 루프).
  useEffect(() => {
    if (!autoTargetLang || !user || !messages) return;
    let alive = true;
    (async () => {
      for (const m of messages) {
        if (!alive) return;
        if (m.type !== 'text' || !m.text || m.senderUid === user.id) continue;
        let skip = false;
        setTranslations((prev) => {
          if (prev[m.id] !== undefined) {
            skip = true;
            return prev;
          }
          return { ...prev, [m.id]: null };
        });
        if (skip) continue;
        const res = await translateText(m.text, autoTargetLang);
        if (!alive) return;
        if (res?.text) {
          setTranslations((prev) => ({ ...prev, [m.id]: res.text }));
          if (res.detectedSourceLang) {
            setSourceLangs((prev) => ({ ...prev, [m.id]: res.detectedSourceLang! }));
          }
        } else {
          // 번역 실패 → 캐시에서 제거. 메시지 새로 들어오거나 언어 바꾸면 재시도.
          setTranslations((prev) => {
            const next = { ...prev };
            delete next[m.id];
            return next;
          });
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [autoTargetLang, messages, user]);

  if (!user || !chatId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="채팅" />
        <View style={styles.center}>
          <Text style={styles.muted}>잘못된 접근입니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const onSendText = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText('');
    try {
      await sendTextMessage(chatId, user.id, t);
    } catch (e: any) {
      showInfoAlert('전송 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setSending(false);
    }
  };

  const onTranslate = async (msg: ChatMessage) => {
    if (msg.type !== 'text' || !msg.text) return;
    const existing = translations[msg.id];
    if (existing !== undefined) {
      // 이미 번역됨 → 토글 (원문 보기로) — 캐시는 유지하기 위해 별도 키
      setTranslations((prev) => {
        const next = { ...prev };
        if (next[msg.id] === '' || next[msg.id] === null) {
          delete next[msg.id];
        } else {
          next[msg.id] = ''; // 빈 문자열 = '원문 보기' 상태
        }
        return next;
      });
      return;
    }
    setTranslations((prev) => ({ ...prev, [msg.id]: null }));
    const result = await translateText(msg.text, myLang);
    if (result?.text) {
      setTranslations((prev) => ({ ...prev, [msg.id]: result.text }));
      if (result.detectedSourceLang) {
        setSourceLangs((prev) => ({ ...prev, [msg.id]: result.detectedSourceLang! }));
      }
    } else {
      // 번역 실패 → 마커 제거. 다시 칩 누르면 재시도 가능.
      setTranslations((prev) => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
      showInfoAlert('번역 실패', '잠시 후 다시 시도해 주세요.');
    }
  };

  const onPickImage = async () => {
    if (sending) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showInfoAlert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (!uri) return;
    setSending(true);
    try {
      await sendImageMessage(chatId, user.id, uri);
    } catch (e: any) {
      showInfoAlert('이미지 전송 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setSending(false);
    }
  };

  const onPickVideo = async () => {
    if (sending) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showInfoAlert('권한 필요', '사진 라이브러리 접근 권한이 필요합니다.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.7,
      videoMaxDuration: 60,
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (!uri) return;
    setSending(true);
    try {
      await sendVideoMessage(chatId, user.id, uri);
    } catch (e: any) {
      showInfoAlert('영상 전송 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setSending(false);
    }
  };

  // 사장님 시점이면 고객 이름, 방문자 시점이면 매장명을 헤더에
  const headerTitle = chat
    ? user.id === chat.merchantUid
      ? chat.visitorDisplayName || '(고객)'
      : chat.shopDisplayName || '(매장)'
    : '채팅';

  const autoTargetName = autoTargetLang ? APP_LANG_TO_NATIVE[autoTargetLang] : null;

  return (
    // KAV 를 최상위로 — keyboardVerticalOffset 측정/하드코딩 불필요(KAV top=0).
    // Android: behavior=undefined + softInputMode 'resize' (app.json) → system 이 window 를
    // 리사이즈, FlatList(flex:1) 가 줄어들고 inputBar 가 키보드 바로 위에 자연 안착.
    // iOS: KAV 'padding' 으로 처리 (iOS 는 system-level RN 키보드 핸들링이 없음).
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScreenHeader
          title={headerTitle}
          rightSlot={
            <Pressable
              onPress={() => setTranslateSheetOpen(true)}
              hitSlop={8}
              style={styles.translateHeaderChip}
            >
              <Languages size={13} color={Colors.primary} strokeWidth={2.2} />
              <Text style={styles.translateHeaderChipText} numberOfLines={1}>
                {autoTargetName ?? '번역'}
              </Text>
            </Pressable>
          }
        />
        {messages === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.msgList}
            renderItem={({ item }) => (
              <Bubble
                msg={item}
                mine={item.senderUid === user.id}
                translation={translations[item.id]}
                sourceLang={sourceLangs[item.id]}
                myLang={myLang}
                autoMode={!!autoTargetLang && item.senderUid !== user.id}
                onTranslate={() => onTranslate(item)}
                onPlayVideo={(url) => setVideoModalUrl(url)}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>대화를 시작해 보세요.</Text>
              </View>
            }
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <View
          style={[
            styles.inputBar,
            { paddingBottom: keyboardOpen ? 8 : Math.max(insets.bottom, 8) + 8 },
          ]}
        >
          <Pressable style={styles.iconBtn} onPress={onPickImage} disabled={sending}>
            <ImageIcon size={22} color={Colors.text} strokeWidth={2} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={onPickVideo} disabled={sending}>
            <VideoIcon size={22} color={Colors.text} strokeWidth={2} />
          </Pressable>
          <RNTextInput
            testID="chatInput"
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={t('chat.messagePlaceholder')}
            multiline
            maxLength={2000}
            editable={!sending}
            onSubmitEditing={onSendText}
          />
          <Pressable
            testID="chatSendBtn"
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={onSendText}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={18} color="#fff" strokeWidth={2.4} />
            )}
          </Pressable>
        </View>

      {videoModalUrl && (
        <VideoPlayerModal url={videoModalUrl} onClose={() => setVideoModalUrl(null)} />
      )}

      {/* 자동 번역 설정 시트 */}
      <Modal
        visible={translateSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTranslateSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setTranslateSheetOpen(false)}>
          <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>받은 메시지 자동 번역</Text>
            <Text style={styles.sheetDesc}>
              상대가 보낸 메시지를 선택한 언어로 자동 변환합니다.
            </Text>

            <Pressable
              style={[styles.sheetRow, autoTargetLang === null && styles.sheetRowActive]}
              onPress={() => saveAutoTarget(null)}
            >
              <Text style={styles.sheetRowLabel}>끄기</Text>
              {autoTargetLang === null && (
                <Check size={18} color={Colors.primary} strokeWidth={2.4} />
              )}
            </Pressable>

            {SUPPORTED_LANGUAGES.map((l) => (
              <Pressable
                key={l.code}
                style={[styles.sheetRow, autoTargetLang === l.code && styles.sheetRowActive]}
                onPress={() => saveAutoTarget(l.code)}
              >
                <Text style={styles.sheetRowLabel}>{l.nativeName}</Text>
                {autoTargetLang === l.code && (
                  <Check size={18} color={Colors.primary} strokeWidth={2.4} />
                )}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function VideoPlayerModal({ url, onClose }: { url: string; onClose: () => void }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.videoModalBackdrop}>
        <Pressable style={styles.videoCloseBtn} onPress={onClose} hitSlop={12}>
          <X size={26} color="#fff" />
        </Pressable>
        <VideoView
          player={player}
          style={styles.videoModalPlayer}
          contentFit="contain"
          nativeControls
          allowsFullscreen
        />
      </View>
    </Modal>
  );
}

// DeepL 언어 코드 → 앱 언어 코드 매핑 (소스 표시용)
const DEEPL_TO_NATIVE: Record<string, string> = {
  KO: '한국어',
  EN: 'English',
  JA: '日本語',
  ZH: '简体中文',
};
const APP_LANG_TO_NATIVE: Record<AppLanguage, string> = {
  ko: '한국어',
  en: 'English',
  ja: '日本語',
  'zh-Hans': '简体中文',
};

function Bubble({
  msg,
  mine,
  translation,
  sourceLang,
  myLang,
  autoMode,
  onTranslate,
  onPlayVideo,
}: {
  msg: ChatMessage;
  mine: boolean;
  translation: string | null | undefined;
  sourceLang: string | undefined;
  myLang: AppLanguage;
  autoMode: boolean;
  onTranslate: () => void;
  onPlayVideo: (url: string) => void;
}) {
  const { t } = useTranslation();
  const wrapStyle = [styles.bubbleWrap, mine ? styles.bubbleWrapRight : styles.bubbleWrapLeft];
  const time = new Date(msg.createdAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (msg.type === 'text') {
    // translation === undefined: 미번역. null: 번역중. '': 토글 OFF. string: 번역 완료
    const isLoading = translation === null;
    const translated = typeof translation === 'string' && translation.length > 0 ? translation : null;
    const targetName = APP_LANG_TO_NATIVE[myLang];
    const sourceName = sourceLang ? DEEPL_TO_NATIVE[sourceLang.toUpperCase()] ?? sourceLang : undefined;
    return (
      <View style={wrapStyle}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
          <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
            {translated ?? msg.text}
          </Text>
          {translated && (
            <Text
              style={[styles.bubbleOriginal, mine ? styles.bubbleOriginalMine : null]}
              numberOfLines={3}
            >
              {sourceName ? `${t('chat.originalLabel', { lang: sourceName })}\n` : ''}
              {msg.text}
            </Text>
          )}
        </View>
        <View style={styles.bubbleFooter}>
          {autoMode ? (
            // 자동 번역 모드 — 헤더에서 일괄 설정. 메시지별 칩 숨김.
            isLoading && (
              <View style={styles.translateChip}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            )
          ) : (
            <Pressable onPress={onTranslate} disabled={isLoading} hitSlop={6}>
              <View style={styles.translateChip}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Languages size={11} color={Colors.primary} strokeWidth={2.2} />
                    <Text style={styles.translateChipText}>
                      {translated ? t('chat.showOriginal') : t('chat.translate', { lang: targetName })}
                    </Text>
                  </>
                )}
              </View>
            </Pressable>
          )}
          <Text style={styles.bubbleTime}>{time}</Text>
        </View>
      </View>
    );
  }
  if (msg.type === 'image' && msg.mediaUrl) {
    return (
      <View style={wrapStyle}>
        <View style={[styles.bubbleMedia, mine ? styles.bubbleMine : styles.bubbleOther]}>
          <Image source={{ uri: msg.mediaUrl }} style={styles.media} resizeMode="cover" />
        </View>
        <Text style={styles.bubbleTime}>{time}</Text>
      </View>
    );
  }
  if (msg.type === 'video' && msg.mediaUrl) {
    return (
      <View style={wrapStyle}>
        <Pressable
          onPress={() => onPlayVideo(msg.mediaUrl!)}
          style={[styles.bubbleVideoPlaceholder, mine ? styles.bubbleMine : styles.bubbleOther]}
        >
          <VideoIcon size={36} color={mine ? '#fff' : Colors.primary} />
          <Text style={[styles.videoLabel, !mine && { color: Colors.primary }]}>탭하여 재생</Text>
        </Pressable>
        <Text style={styles.bubbleTime}>{time}</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontSize: 13, color: Colors.textMuted },
  msgList: { paddingHorizontal: 12, paddingVertical: 12 },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, color: Colors.textMuted },

  bubbleWrap: { maxWidth: '80%' },
  bubbleWrapLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubbleWrapRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: Colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  bubbleText: { fontSize: 14, color: Colors.text, lineHeight: 19 },
  bubbleTextMine: { color: '#fff' },
  bubbleOriginal: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  bubbleOriginalMine: { color: 'rgba(255,255,255,0.75)', borderTopColor: 'rgba(255,255,255,0.25)' },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
    paddingHorizontal: 4,
  },
  translateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(11,46,90,0.08)',
  },
  translateChipText: { fontSize: 10, color: Colors.primary, fontWeight: '700' },
  bubbleTime: { fontSize: 10, color: Colors.textMuted, paddingHorizontal: 2 },
  bubbleMedia: {
    padding: 4,
    borderRadius: 14,
    overflow: 'hidden',
  },
  media: { width: 200, height: 200, borderRadius: 10 },
  bubbleVideoPlaceholder: {
    width: 200,
    height: 140,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLabel: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  iconBtn: { padding: 8 },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },

  // 헤더 우측 자동 번역 chip
  translateHeaderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(11,46,90,0.08)',
  },
  translateHeaderChipText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
  },

  // 자동 번역 설정 시트
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  sheetTitle: { fontSize: 16, fontWeight: '900', color: Colors.text },
  sheetDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 4, marginBottom: 12 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    marginTop: 8,
  },
  sheetRowActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(11,46,90,0.06)',
  },
  sheetRowLabel: { fontSize: 14, color: Colors.text, fontWeight: '700' },

  videoModalBackdrop: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoCloseBtn: {
    position: 'absolute',
    top: 48,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  videoModalPlayer: {
    width: '100%',
    height: '70%',
  },
});

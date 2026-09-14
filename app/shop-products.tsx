import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Edit3, Package, Plus, Trash2, X } from 'lucide-react-native';
import { Button } from '@/components/common/Button';
import { TextInput } from '@/components/common/TextInput';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/stores/authStore';
import {
  MAX_PHOTOS_PER_PRODUCT,
  MAX_PRODUCTS_PER_SHOP,
  createProduct,
  deleteProduct,
  deleteProductPhoto,
  subscribeProducts,
  updateProduct,
  uploadProductPhoto,
} from '@/lib/shopProducts';
import { showConfirmAlert, showInfoAlert } from '@/utils/alerts';
import type { ShopPhoto, ShopProduct } from '@/types';

export default function ShopProductsScreen() {
  const params = useLocalSearchParams<{ shopId?: string }>();
  const shopId = typeof params.shopId === 'string' ? params.shopId : '';
  const user = useAuthStore((s) => s.user);

  const [products, setProducts] = useState<ShopProduct[] | null>(null);
  const [editTarget, setEditTarget] = useState<ShopProduct | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!shopId) return;
    const unsub = subscribeProducts(shopId, setProducts);
    return () => unsub();
  }, [shopId]);

  if (!user || !shopId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader title="상품 관리" />
        <View style={styles.center}>
          <Text style={styles.muted}>잘못된 접근입니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const onDelete = (p: ShopProduct) => {
    showConfirmAlert(
      '상품 삭제',
      `'${p.name}' 상품을 삭제할까요? 사진도 함께 삭제됩니다.`,
      async () => {
        setBusy(p.id);
        try {
          await deleteProduct(shopId, p.id);
        } catch (e: any) {
          showInfoAlert('삭제 실패', e?.message ?? '네트워크 오류입니다.');
        } finally {
          setBusy(null);
        }
      },
      { confirmLabel: '삭제', destructive: true },
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader title="상품 관리" />

      <View style={styles.toolbar}>
        <Text style={styles.toolbarCount}>
          {products?.length ?? 0} / {MAX_PRODUCTS_PER_SHOP} 개
        </Text>
        <Pressable
          style={[
            styles.addBtn,
            (products?.length ?? 0) >= MAX_PRODUCTS_PER_SHOP && styles.addBtnDisabled,
          ]}
          onPress={() => {
            if ((products?.length ?? 0) >= MAX_PRODUCTS_PER_SHOP) {
              showInfoAlert('한도 초과', `매장당 최대 ${MAX_PRODUCTS_PER_SHOP}개까지 등록 가능합니다.`);
              return;
            }
            setEditTarget('new');
          }}
        >
          <Plus size={16} color="#fff" strokeWidth={2.4} />
          <Text style={styles.addBtnText}>상품 추가</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {products === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : products.length === 0 ? (
          <View style={styles.empty}>
            <Package size={40} color={Colors.textMuted} strokeWidth={1.4} />
            <Text style={styles.emptyTitle}>아직 등록된 상품이 없어요</Text>
            <Text style={styles.emptyDesc}>
              사진과 가격을 등록해서 손님에게 직접 보여줄 수 있어요.
            </Text>
            <Button label="첫 상품 추가" onPress={() => setEditTarget('new')} style={{ marginTop: 12 }} />
          </View>
        ) : (
          products.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              busy={busy === p.id}
              onEdit={() => setEditTarget(p)}
              onDelete={() => onDelete(p)}
            />
          ))
        )}
      </ScrollView>

      {editTarget && (
        <ProductEditor
          shopId={shopId}
          product={editTarget === 'new' ? null : editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
    </SafeAreaView>
  );
}

function ProductCard({
  p,
  busy,
  onEdit,
  onDelete,
}: {
  p: ShopProduct;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cover = p.photos[0]?.url;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.cardCover} />
        ) : (
          <View style={[styles.cardCover, styles.cardCoverEmpty]}>
            <Package size={24} color={Colors.textMuted} strokeWidth={1.5} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={2}>{p.name}</Text>
          {p.priceText && <Text style={styles.cardPrice}>{p.priceText}</Text>}
          {p.description ? (
            <Text style={styles.cardDesc} numberOfLines={2}>{p.description}</Text>
          ) : null}
          {p.photos.length > 1 && (
            <Text style={styles.cardPhotoCount}>사진 {p.photos.length}장</Text>
          )}
        </View>
      </View>
      <View style={styles.cardActions}>
        <Pressable style={styles.cardActionBtn} onPress={onEdit} disabled={busy}>
          <Edit3 size={15} color={Colors.text} strokeWidth={2.2} />
          <Text style={styles.cardActionText}>수정</Text>
        </Pressable>
        <Pressable style={[styles.cardActionBtn, styles.cardActionBtnDanger]} onPress={onDelete} disabled={busy}>
          {busy ? (
            <ActivityIndicator size="small" color={Colors.danger} />
          ) : (
            <>
              <Trash2 size={15} color={Colors.danger} strokeWidth={2.2} />
              <Text style={[styles.cardActionText, { color: Colors.danger }]}>삭제</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ProductEditor({
  shopId,
  product,
  onClose,
}: {
  shopId: string;
  product: ShopProduct | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [priceText, setPriceText] = useState(product?.priceText ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [photos, setPhotos] = useState<ShopPhoto[]>(product?.photos ?? []);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const onAddPhoto = async () => {
    if (photos.length >= MAX_PHOTOS_PER_PRODUCT) {
      showInfoAlert('한도', `상품당 최대 ${MAX_PHOTOS_PER_PRODUCT}장입니다.`);
      return;
    }
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
    setUploadingPhoto(true);
    try {
      const p = await uploadProductPhoto(shopId, uri);
      setPhotos((prev) => [...prev, p]);
    } catch (e: any) {
      showInfoAlert('업로드 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const onRemovePhoto = async (photo: ShopPhoto) => {
    setPhotos((prev) => prev.filter((p) => p.storagePath !== photo.storagePath));
    // Storage 정리는 백그라운드 (저장 누르지 않고 닫으면 orphan 됨 — 허용 범위)
    deleteProductPhoto(photo).catch(() => {});
  };

  const canSave = name.trim().length >= 2 && !saving && !uploadingPhoto;

  const onSave = async () => {
    setSaving(true);
    try {
      if (product) {
        await updateProduct(shopId, product.id, {
          name: name.trim(),
          priceText: priceText.trim() || undefined,
          description: description.trim() || undefined,
          photos,
        });
      } else {
        await createProduct(shopId, {
          name: name.trim(),
          priceText: priceText.trim() || undefined,
          description: description.trim() || undefined,
          photos,
        });
      }
      onClose();
    } catch (e: any) {
      showInfoAlert('저장 실패', e?.message ?? '네트워크 오류입니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={editStyles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={editStyles.sheet}
        >
          <View style={editStyles.head}>
            <Text style={editStyles.title}>{product ? '상품 수정' : '새 상품'}</Text>
            <Pressable hitSlop={12} onPress={onClose} disabled={saving}>
              <X size={22} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={editStyles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={editStyles.label}>상품 사진 ({photos.length}/{MAX_PHOTOS_PER_PRODUCT})</Text>
            <View style={editStyles.photoRow}>
              {photos.map((p) => (
                <View key={p.storagePath} style={editStyles.photoCell}>
                  <Image source={{ uri: p.url }} style={editStyles.photoImg} />
                  <Pressable
                    style={editStyles.photoRemove}
                    onPress={() => onRemovePhoto(p)}
                    hitSlop={6}
                  >
                    <Trash2 size={12} color="#fff" strokeWidth={2.4} />
                  </Pressable>
                </View>
              ))}
              {photos.length < MAX_PHOTOS_PER_PRODUCT && (
                <Pressable style={[editStyles.photoCell, editStyles.photoAdd]} onPress={onAddPhoto} disabled={uploadingPhoto}>
                  {uploadingPhoto ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : (
                    <>
                      <Camera size={18} color={Colors.primary} strokeWidth={2} />
                      <Text style={editStyles.photoAddText}>추가</Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>

            <TextInput
              label="상품명 *"
              placeholder="예: 면 자카드 원단"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              label="가격 (선택)"
              placeholder="예: 5,000원/yd · 도매가 3,500원"
              value={priceText}
              onChangeText={setPriceText}
            />
            <Text style={editStyles.label}>특징 / 설명 (선택)</Text>
            <RNTextInput
              value={description}
              onChangeText={setDescription}
              placeholder="소재, 사이즈, 색상, 거래 단위 등"
              placeholderTextColor={Colors.textMuted}
              style={editStyles.textArea}
              multiline
              maxLength={4000}
            />
          </ScrollView>

          <View style={editStyles.btnRow}>
            <Button label="취소" variant="secondary" onPress={onClose} style={{ flex: 1 }} disabled={saving} />
            <Button label={saving ? '저장 중...' : '저장'} onPress={onSave} disabled={!canSave} loading={saving} style={{ flex: 1 }} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { fontSize: 13, color: Colors.textMuted },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  toolbarCount: { fontSize: 12, color: Colors.textMuted, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  scroll: { padding: 16, gap: 10, paddingBottom: 32 },
  empty: { alignItems: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginTop: 8 },
  emptyDesc: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },

  card: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  cardHead: { flexDirection: 'row', gap: 10 },
  cardCover: { width: 72, height: 72, borderRadius: 8, backgroundColor: Colors.background },
  cardCoverEmpty: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  cardName: { fontSize: 14, fontWeight: '800', color: Colors.text },
  cardPrice: { fontSize: 13, color: Colors.primary, fontWeight: '700', marginTop: 2 },
  cardDesc: { fontSize: 11, color: Colors.textMuted, marginTop: 4, lineHeight: 16 },
  cardPhotoCount: { fontSize: 10, color: Colors.textMuted, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: 8 },
  cardActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardActionBtnDanger: { borderColor: Colors.danger, backgroundColor: '#FFF5F5' },
  cardActionText: { fontSize: 12, fontWeight: '700', color: Colors.text },
});

const editStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '92%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  title: { fontSize: 16, fontWeight: '800', color: Colors.text },
  scroll: { padding: 18, gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, marginTop: 4, marginBottom: 6 },

  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  photoCell: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoAdd: {
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    backgroundColor: '#F0F4FB',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  photoAddText: { fontSize: 11, color: Colors.primary, fontWeight: '700' },

  textArea: {
    minHeight: 100,
    maxHeight: 200,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    fontSize: 14,
    color: Colors.text,
    textAlignVertical: 'top',
  },

  btnRow: { flexDirection: 'row', gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: Colors.divider },
});

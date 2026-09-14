import { CategoryKey, PartsCategory } from '@/types';
import { CATEGORY_LABEL } from './categories';

/** 부자재 찾기 화면에서 노출할 카테고리 순서. */
export const PARTS_CATEGORY_ORDER: PartsCategory[] = [
  'fabric',
  'lace',
  'button',
  'thread',
  'accessory',
  'clothing_accessory',
  'bedding',
  'curtain',
  'home_interior',
  'towel',
  'leather',
  'fur',
  'hanbok',
  'handicraft',
  'etc',
];

export const PARTS_CATEGORY_LABEL: Record<PartsCategory, string> = {
  fabric: CATEGORY_LABEL.fabric,
  lace: CATEGORY_LABEL.lace,
  button: CATEGORY_LABEL.button,
  thread: CATEGORY_LABEL.thread,
  accessory: CATEGORY_LABEL.accessory,
  clothing_accessory: CATEGORY_LABEL.clothing_accessory,
  bedding: CATEGORY_LABEL.bedding,
  curtain: CATEGORY_LABEL.curtain,
  home_interior: CATEGORY_LABEL.home_interior,
  towel: CATEGORY_LABEL.towel,
  leather: CATEGORY_LABEL.leather,
  fur: CATEGORY_LABEL.fur,
  hanbok: CATEGORY_LABEL.hanbok,
  handicraft: CATEGORY_LABEL.handicraft,
  etc: '기타',
};

// 미사용이지만 PartsCategory 가 CategoryKey 의 부분집합 + 'etc' 라는 의도를 타입으로 박아둠
type _Assert = Exclude<Exclude<PartsCategory, 'etc'>, CategoryKey> extends never ? true : false;
const _check: _Assert = true;
void _check;

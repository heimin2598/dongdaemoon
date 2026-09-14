import type { DayOfWeek, OperatingStatus, Shop } from '@/types';

/**
 * 매장 영업 상태 표시용 헬퍼.
 *
 * - operatingStatusUntil 이 지났으면 자동으로 'open' 으로 reset 된 것으로 간주 (UI 표시 시).
 *   실제 Firestore 데이터는 사장님이 다시 토글할 때까지 그대로지만, 손님이 볼 때는 자동 복귀.
 * - businessHoursSchedule 상 오늘이 휴무일이면 default 'open' 도 자동 'closed' 로 표시.
 *   사장이 lunch/away/closed 로 명시 토글한 경우는 그대로 표시 (수동 설정 우선).
 */

const JS_DAY_TO_KEY: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function isScheduleClosedToday(shop: Shop | null | undefined, now: number): boolean {
  const schedule = shop?.businessHoursSchedule;
  if (!schedule || schedule.length === 0) return false;
  const today = JS_DAY_TO_KEY[new Date(now).getDay()];
  const entry = schedule.find((s) => s.day === today);
  // 스케줄에 오늘 entry 가 명시되고 enabled === false 면 휴무.
  // 아예 entry 가 없으면 미설정 → 휴무 아님 (보수적 처리).
  return !!entry && entry.enabled === false;
}

export interface StatusDisplay {
  status: OperatingStatus;
  label: string;
  emoji: string;
  bg: string;
  color: string;
  /** 'lunch' / 'away' 인 경우 복귀 예정 시각 안내 ("13시 복귀") */
  untilLabel?: string;
}

const PRESETS: Record<OperatingStatus, Omit<StatusDisplay, 'untilLabel'>> = {
  open: { status: 'open', label: '영업중', emoji: '🟢', bg: '#E0F2E9', color: '#1B7A3E' },
  lunch: { status: 'lunch', label: '점심시간', emoji: '🟡', bg: '#FFF3D6', color: '#A66A00' },
  away: { status: 'away', label: '잠시 자리비움', emoji: '🟠', bg: '#FFE6CC', color: '#C45A00' },
  closed: { status: 'closed', label: '휴무', emoji: '🔴', bg: '#FBE4E4', color: '#C53030' },
};

export function getShopStatusDisplay(shop: Shop | null | undefined, now = Date.now()): StatusDisplay {
  const raw: OperatingStatus = shop?.operatingStatus ?? 'open';
  const until = shop?.operatingStatusUntil ?? null;

  // 'lunch' / 'away' 이고 untilMs 가 지났으면 자동 복귀.
  let effective: OperatingStatus = raw;
  if ((raw === 'lunch' || raw === 'away') && until && until <= now) {
    effective = 'open';
  }

  // 사장이 명시적으로 lunch/away/closed 로 토글한 경우는 그대로 표시.
  // default 'open' 이고 오늘이 스케줄상 휴무면 자동 'closed' 로 override.
  if (effective === 'open' && isScheduleClosedToday(shop, now)) {
    return PRESETS.closed;
  }

  const base = PRESETS[effective] ?? PRESETS.open;
  if ((effective === 'lunch' || effective === 'away') && until && until > now) {
    const d = new Date(until);
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return { ...base, untilLabel: `${hh}:${mm} 복귀` };
  }
  return base;
}

export const OPERATING_OPTIONS: Array<{
  status: OperatingStatus;
  label: string;
  emoji: string;
  hint: string;
  presetUntilMinutes?: number; // 'lunch' = 60, 'away' = 30 등 기본 복귀 시간
}> = [
  { status: 'open', label: '영업중', emoji: '🟢', hint: '정상 영업' },
  { status: 'lunch', label: '점심시간', emoji: '🟡', hint: '복귀 후 자동 영업중', presetUntilMinutes: 60 },
  { status: 'away', label: '잠시 자리비움', emoji: '🟠', hint: '15~30분 단위 추천', presetUntilMinutes: 30 },
  { status: 'closed', label: '휴무', emoji: '🔴', hint: '오늘 휴무' },
];

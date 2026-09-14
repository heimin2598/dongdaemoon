import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { ReportReason, ReportTargetType } from '@/types';

export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  spam: '스팸 / 광고',
  abuse: '욕설 / 비방',
  inappropriate: '부적절한 콘텐츠',
  fake: '허위 정보',
  copyright: '저작권 침해',
  other: '기타',
};

export const REPORT_REASON_ORDER: ReportReason[] = [
  'spam',
  'abuse',
  'inappropriate',
  'fake',
  'copyright',
  'other',
];

export const MAX_REPORT_DETAIL = 1000;

interface SubmitReportInput {
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerUid: string;
  reason: ReportReason;
  detail?: string;
}

/** 신고 제출. 작성만 가능 — Firestore Rules 가 read/update/delete 차단. */
export async function submitReport(input: SubmitReportInput): Promise<string> {
  const u = auth.currentUser;
  if (!u) throw new Error('로그인이 필요합니다.');
  const ref = await addDoc(collection(db, 'reports'), {
    reporterUid: u.uid,
    targetType: input.targetType,
    targetId: input.targetId,
    targetOwnerUid: input.targetOwnerUid,
    reason: input.reason,
    detail: (input.detail ?? '').trim().slice(0, MAX_REPORT_DETAIL),
    status: 'open',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

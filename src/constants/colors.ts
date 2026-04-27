export const Colors = {
  primary: '#0B2E5A',
  primaryLight: '#1C4E8C',
  accent: '#E63946',
  background: '#F7F7F9',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  border: '#E3E5EB',
  text: '#1A1A1F',
  textMuted: '#6B7280',
  textInverse: '#FFFFFF',
  success: '#2E8B57',
  warning: '#F5A623',
  danger: '#D64545',
  divider: '#ECEEF2',
  overlay: 'rgba(0,0,0,0.4)',
};

export const BuildingColors: Record<'A' | 'B' | 'C' | 'N', {
  primary: string;
  soft: string;
  text: string;
}> = {
  A: { primary: '#1F4FB0', soft: '#E6EEFB', text: '#FFFFFF' },
  B: { primary: '#D4345A', soft: '#FBE6EC', text: '#FFFFFF' },
  C: { primary: '#2E8B57', soft: '#E4F3EB', text: '#FFFFFF' },
  N: { primary: '#E5B720', soft: '#FFF4D0', text: '#1A1A1F' },
};

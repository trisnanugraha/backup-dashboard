// Response shapes of the backup-monitoring API (see api/src/services).

export type BackupStatus = 'OK' | 'ERROR';
export type Severity = 'OK' | 'WARN' | 'CRITICAL';
export type AppCategory = 'Strategis' | 'Tinggi' | 'Sedang' | 'Rendah' | '';
export type EntityType = 'host' | 'group' | 'verify_app';

export interface StatsBackup {
  successRateToday: number;
  totalGroupBackup: number;
  totalHostToday: number;
  totalOkToday: number;
  totalFailToday: number;
}

export interface StatsVerify {
  successRateVerify: number;
  totalGroupVerify: number;
  totalVerifyApp: number;
  totalVerifyOk: number;
  totalVerifyWarn: number;
  totalVerifyCrit: number;
}

export interface NoteFields {
  note: string;
  note_category: string;
}

export interface ProblemApp extends NoteFields {
  domain: string;
  group: string;
  severity: Exclude<Severity, 'OK'>;
  app_category: AppCategory;
  latest_snapshot_time: string | null;
  age_days: number | null;
}

export interface OkApp {
  domain: string;
  app_category: AppCategory;
}

export interface GroupStatus extends NoteFields {
  group: string;
  ok: number | null;
  fail: number | null;
  total: number | null;
  report_status: 'reported' | 'pending';
  usual_report_time?: string;
  note_active?: boolean;
}

export interface HostDetail {
  group: string;
  host: string;
  status: BackupStatus;
  error_reason: string;
}

export interface VerifyGroup extends NoteFields {
  group: string;
  ok: number;
  warn: number;
  critical: number;
  total: number;
  problemApps: ProblemApp[];
  okApps: OkApp[];
}

export interface DailyRate {
  date: string;
  successRate: number;
}

export interface Dashboard {
  windowLabel: string;
  windowKemarin: { label: string; stats: StatsBackup; statsVerify: StatsVerify };
  stats: StatsBackup;
  statsVerify: StatsVerify;
  trendBackup: { date: string; ok: number; fail: number; total: number; successRate: number }[];
  trendVerify: { date: string; ok: number; total: number; successRate: number }[];
  topFailHosts: { host: string; group: string; failCount: number; sparkline: (BackupStatus | null)[] }[];
  topFailGroups: { group: string; failDaysCount: number; totalFailInstances: number }[];
  todaySummary: GroupStatus[];
  hostDetails: HostDetail[];
  verifySummary: VerifyGroup[];
  strategicProblemApps: ProblemApp[];
  categoryCounts: Record<'Strategis' | 'Tinggi' | 'Sedang' | 'Rendah' | 'Belum Berlabel', number>;
  calendarBackup: DailyRate[];
  calendarVerify: DailyRate[];
  generatedAt: string;
}

export interface HistoryGroupItem {
  group: string;
  total_hosts: number;
  hosts_with_fail: number;
  verify_severity: Severity | '-';
  note: string;
}

export interface HostHistory extends NoteFields {
  host: string;
  last_status: BackupStatus | '-';
  last_date: string;
  ok_days: number;
  fail_days: number;
  total_days: number;
  consistency: number;
  failing: boolean;
  streak_days: number;
  failing_since: string | null;
  backup_timeline: { date: string; status: BackupStatus; error_reason: string }[];
}

export interface GroupHistory extends NoteFields {
  group: string;
  total_hosts: number;
  hosts_with_fail: number;
  verify_severity: Severity | '-';
  verify_timeline: { date: string; ok: number; warn: number; critical: number; total: number }[];
  backup_daily_summary: { date: string; ok: number; fail: number; total: number; successRate: number }[];
  verify_apps: (NoteFields & {
    domain: string;
    severity: Severity | '-';
    latest_snapshot_time: string | null;
    app_category: AppCategory;
  })[];
  changed_hosts: { host: string; from: string; to: string; date: string }[];
  hosts: HostHistory[];
  calendar_backup: DailyRate[];
  calendar_verify: DailyRate[];
}

// Shared API types (mirror backend serializers).

export type ProjectPhase =
  | "pre_sale"
  | "execution"
  | "ma"
  | "closed"
  | "cancelled";

export type HealthStatus =
  | "not_started"
  | "on_plan"
  | "at_risk"
  | "delay"
  | "completed";

export interface Project {
  id: number;
  project_name: string;
  project_code: string | null;
  client: number;
  client_name: string;
  client_abbreviation: string | null;
  value_thb?: string | null; // present only for Admin/DM
  po_user: number | null;
  po_name: string;
  start_date: string | null;
  end_date: string | null;
  project_phase: ProjectPhase;
  health_status: HealthStatus;
  health_reason: string;
  delay_days: number;
  progress: number | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: number;
  client_name: string;
  client_abbreviation: string | null;
  client_website: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TeamMember {
  id: number;
  full_name: string;
  email: string;
  role: "admin" | "dm" | "bsa" | "dev";
  position: string;
  employment_type: "permanent" | "contractor";
  is_allowed: boolean;
}

export type Role = "admin" | "dm" | "bsa" | "dev";
export type EmploymentType = "permanent" | "contractor";
export type PermissionAction = "view" | "create" | "edit" | "delete";

export interface UserAccount {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  position: string;
  employment_type: EmploymentType;
  is_allowed: boolean;
  created_at: string;
  updated_at: string;
}

export interface RolePermission {
  id: number;
  role: Role;
  module: string;
  action: PermissionAction;
  allowed: boolean;
}

export interface Holiday {
  id: number;
  holiday_date: string;
  name: string;
  type: "public" | "company";
}

export interface SystemSetting {
  id: number | null;
  key: "HOURS_PER_WORKING_DAY" | "health_threshold_at_risk" | "health_threshold_delay";
  value: string;
  updated_by: number | null;
  updated_at: string | null;
}

export interface ProjectTeamMember {
  id: number;
  project: number;
  user: number;
  full_name: string;
  email: string;
  user_role: Role;
  role_in_project: string;
  responsibilities: string;
  allocation_percentage: number | null;
}

export interface DashboardTeamMember {
  user: number;
  full_name: string;
  email: string;
  role_in_project: string;
  allocation_percentage: number | null;
}

export interface DashboardActivity {
  user: number;
  full_name: string;
  last_date: string;
  hours: string;
}

export interface DashboardProject {
  id: number;
  project_name: string;
  project_code: string | null;
  client_name: string;
  client_abbreviation: string | null;
  project_phase: ProjectPhase;
  health_status: HealthStatus;
  health_reason: string;
  delay_days: number;
  start_date: string | null;
  end_date: string | null;
  progress: number | null;
  task_counts: { total: number } & Record<TaskStatusKey, number>;
  team: DashboardTeamMember[];
  recent_activity: DashboardActivity[];
  value_thb?: string | null; // present only for Admin/DM
}

export interface DashboardResponse {
  generated_at: string;
  activity_window_days: number;
  rollups: {
    total: number;
    by_health: Record<HealthStatus, number>;
    by_phase: Record<ProjectPhase, number>;
  };
  projects: DashboardProject[];
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface PlanItem {
  id: number;
  project: number;
  phase: string;
  task: string;
  manday: string | null;
  start_date: string | null;
  end_date: string | null;
  input_mode: "manday" | "date" | "auto";
  is_milestone: boolean;
  sort_order: number;
  progress: number | null;
}

export type DependencyRelationType =
  | "finish_to_start"
  | "start_to_start"
  | "finish_to_finish"
  | "start_to_finish";

export interface Dependency {
  id: number;
  project: number;
  predecessor: number;
  successor: number;
  relation_type: DependencyRelationType;
  lag_days: number;
}

export interface PlanResponse {
  items: PlanItem[];
  totals_by_phase: { phase: string; manday: number }[];
  total_manday: number;
  dependencies: Dependency[];
}

export interface PlanRevision {
  id: number;
  plan_item: number;
  field_name: string;
  old_value: string;
  new_value: string;
  change_reason: string;
  changed_by: number | null;
  changed_by_name: string;
  changed_at: string;
}

export type TaskStatusKey = "not_started" | "working" | "stuck" | "done" | "verified";
export type TaskStateKey =
  | "get_req"
  | "design"
  | "development"
  | "test"
  | "training"
  | "go_live";

export interface Task {
  id: number;
  title: string;
  detail: string;
  project: number;
  project_name: string;
  assigned_to: number | null;
  assigned_to_name: string;
  plan_item: number | null;
  state: TaskStateKey;
  status: TaskStatusKey;
  source: "manual" | "meeting" | "plan" | "external";
  estimated_manday: string | null;
  scheduled_date: string | null;
}

export const TASK_STATUS_LABEL: Record<TaskStatusKey, string> = {
  not_started: "ยังไม่เริ่ม",
  working: "กำลังทำ",
  stuck: "ติดปัญหา",
  done: "เสร็จ (Done)",
  verified: "ตรวจแล้ว (Verified)",
};

export const TASK_STATUS_COLOR: Record<TaskStatusKey, string> = {
  not_started: "var(--txt-faint)",
  working: "var(--accent-2)",
  stuck: "var(--danger)",
  done: "var(--warn)",
  verified: "var(--ok)",
};

export const TASK_STATE_LABEL: Record<TaskStateKey, string> = {
  get_req: "Get Req",
  design: "Design",
  development: "Development",
  test: "Test",
  training: "Training",
  go_live: "Go Live",
};

export interface DailyEntry {
  id: number;
  user: number;
  work_date: string;
  task: number | null;
  task_title: string;
  project: number | null;
  project_name: string;
  source: "manual" | "meeting" | "plan";
  title: string;
  detail: string;
  status_snapshot: TaskStatusKey | null;
  hours: string;
  is_ot: boolean;
  calendar_event_id: string;
  created_at: string;
}

export interface DailyListResponse {
  results: DailyEntry[];
  total_hours: string;
  work_date: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  hours: string;
  all_day?: boolean;
  html_link: string;
}

export interface CalendarEventsResponse {
  connected: boolean;
  events: CalendarEvent[];
  detail?: string;
}

export interface SummaryEntry {
  id: number;
  user: number;
  user_name: string;
  work_date: string;
  title: string;
  detail: string;
  status_snapshot: TaskStatusKey | null;
  hours: string;
  is_ot: boolean;
}

export interface SummaryNote {
  id: number;
  user: number;
  user_name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface SummaryGroup {
  project_id: number | null;
  project_name: string;
  hours: string;
  entries: SummaryEntry[];
  notes: SummaryNote[];
}

// --- สรุปงานของฉัน (My Work Summary) ---------------------------------------
export interface MySummaryEntry {
  id: number;
  work_date: string;
  title: string;
  detail: string;
  status_snapshot: TaskStatusKey | null;
  task_title: string;
  source: "manual" | "meeting" | "plan";
  hours: string;
  is_ot: boolean;
}

export interface MySummaryNote {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface MySummaryGroup {
  project_id: number | null;
  project_name: string;
  hours: string;
  entries: MySummaryEntry[];
  notes: MySummaryNote[];
}

export interface MyWorkSummary {
  range: { from: string; to: string };
  total_hours: string;
  groups: MySummaryGroup[];
}

export interface MeetingSummary {
  range: { from: string; to: string };
  total_hours: string;
  groups: SummaryGroup[];
  hours_by_project: { project_id: number | null; project_name: string; hours: string }[];
}

export interface MissingSubmission {
  working_days: string[];
  missing: { user: number; full_name: string; role: string; missing_dates: string[]; missing_count: number }[];
}

export interface CostLineItem {
  id: number;
  category?: string;
  label: string;
  qty_or_units: string;
  months: string;
  rate: string;
  total: string;
  total_override?: string | null;
  is_outsource: boolean;
  note: string;
}

export interface BudgetCategory {
  category: string;
  category_label: string;
  total: string;
  headcount?: string;
  items?: CostLineItem[];
}

export interface Budget {
  categories: BudgetCategory[];
  grand_total: string;
  can_see_rate: boolean;
  show_headcount: boolean;
  vat_note: string;
}

// --- Risk register -----------------------------------------------------------
export type RiskSeverity = "low" | "medium" | "high";
export type RiskStatus = "open" | "monitoring" | "closed";

export interface RiskLog {
  id: number;
  action: "created" | "severity" | "status" | "mitigation";
  detail: string;
  by: number | null;
  by_name: string;
  at: string;
}

export interface Risk {
  id: number;
  project: number;
  title: string;
  detail: string;
  severity: RiskSeverity;
  status: RiskStatus;
  mitigation: string;
  created_by: number | null;
  created_by_name: string;
  logs: RiskLog[];
  created_at: string;
  updated_at: string;
}

export const RISK_SEVERITY_LABEL: Record<RiskSeverity, string> = {
  low: "ต่ำ",
  medium: "ปานกลาง",
  high: "สูง",
};

export const RISK_SEVERITY_COLOR: Record<RiskSeverity, string> = {
  low: "var(--ok)",
  medium: "var(--warn)",
  high: "var(--danger)",
};

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  open: "เปิดอยู่",
  monitoring: "เฝ้าระวัง",
  closed: "ปิดแล้ว",
};

export const RISK_LOG_ACTION_LABEL: Record<RiskLog["action"], string> = {
  created: "บันทึกความเสี่ยง",
  severity: "เปลี่ยนความรุนแรง",
  status: "เปลี่ยนสถานะ",
  mitigation: "ปรับวิธีจัดการ",
};

// --- Infrastructure registry (actuals) ---------------------------------------
export type AssetType = "server" | "subscription" | "domain" | "license" | "other";
export type AssetEnvironment = "dev" | "uat" | "prod" | "";
export type BillingCycle = "one_time" | "monthly" | "yearly";
export type AssetStatus = "active" | "cancelled";

export interface InfraAsset {
  id: number;
  name: string;
  asset_type: AssetType;
  provider: string;
  location: string;
  environment: AssetEnvironment;
  project: number | null;
  project_name: string;
  cost?: string; // Admin/DM only
  billing_cycle: BillingCycle;
  monthly_cost?: string; // Admin/DM only
  start_date: string | null;
  expires_at: string | null;
  status: AssetStatus;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface InfraSummary {
  total: number;
  active: number;
  expiring_soon: number[];
  expired: number[];
  window_days: number;
  monthly_cost_total?: string; // Admin/DM only
  one_time_total?: string;
}

export interface InfraResponse {
  summary: InfraSummary;
  assets: InfraAsset[];
}

export const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  server: "Server",
  subscription: "Subscription",
  domain: "Domain",
  license: "License",
  other: "อื่นๆ",
};

export const ASSET_ENV_LABEL: Record<Exclude<AssetEnvironment, "">, string> = {
  dev: "Dev",
  uat: "UAT",
  prod: "Production",
};

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  one_time: "ครั้งเดียว",
  monthly: "รายเดือน",
  yearly: "รายปี",
};

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  active: "ใช้งานอยู่",
  cancelled: "ยกเลิกแล้ว",
};

export const PHASE_LABEL: Record<ProjectPhase, string> = {
  pre_sale: "Pre-sale",
  execution: "Execution",
  ma: "MA",
  closed: "ปิดโครงการ",
  cancelled: "ยกเลิก",
};

export const HEALTH_LABEL: Record<HealthStatus, string> = {
  not_started: "ยังไม่เริ่ม",
  on_plan: "ตามแผน",
  at_risk: "เสี่ยง",
  delay: "ล่าช้า",
  completed: "เสร็จสมบูรณ์",
};

// Health -> token color (status pills use --ok / --warn / --danger).
export const HEALTH_COLOR: Record<HealthStatus, string> = {
  not_started: "var(--txt-faint)",
  on_plan: "var(--ok)",
  at_risk: "var(--warn)",
  delay: "var(--danger)",
  completed: "var(--accent)",
};

export interface Barangay {
  id?: number;
  municipality: string;
  barangay_name: string;
  puroks: number;
  pk_teams: number;
  pk_team_members: number;
  pk_kits_received: number;
  pk_members_oriented: number;
  program1_target: number;
  program2_name: string;
  program2_target: number;
  program3_name: string;
  program3_target: number;
  program4_name: string;
  program4_target: number;
  actual_population: number;
  projected_population: number;
}

export interface Patient {
  id?: number;
  full_name: string;
  municipality: string;
  barangay: string;
  birthdate: string;
  sex: 'Male' | 'Female';
  history?: PatientService[];
  
  // Flattened latest service fields for list view compatibility
  date_of_service?: string;
  health_promotion?: boolean;
  fpe?: boolean;
  philhealth?: boolean;
  referral?: boolean;
  nutrition?: boolean;
  cancer?: boolean;
  immunization?: boolean;
  hpn?: boolean;
  dm?: boolean;
  maternal_health?: boolean;
  road_safety?: boolean;
  mental_health?: boolean;
  tb?: boolean;
  hiv?: boolean;
  wash?: boolean;
  large_scale_pk_activity?: boolean;
}

export interface PatientService {
  id?: number;
  patient_id: number;
  date_of_service: string;
  health_promotion: boolean;
  fpe: boolean;
  philhealth: boolean;
  referral: boolean;
  nutrition: boolean;
  cancer: boolean;
  immunization: boolean;
  hpn: boolean;
  dm: boolean;
  maternal_health: boolean;
  road_safety: boolean;
  mental_health: boolean;
  tb: boolean;
  hiv: boolean;
  wash: boolean;
  large_scale_pk_activity: boolean;
  created_at?: string;
}

export interface MunicipalityStat {
  name: string;
  target: number;
  served: number;
  percentage: number;
  householdsTarget: number;
  householdsServed: number;
  householdsPercentage?: number;
  totalPercentage?: number;
}

export interface BarangayStat {
  municipality: string;
  barangay: string;
  target: number;
  served: number;
  percentage: number;
  householdsTarget: number;
  householdsServed: number;
  householdsPercentage: number;
  totalPercentage: number;
  healthPromotion: number;
  fpe: number;
  philhealth: number;
  referral: number;
  pkActivities: number;
  puroks: number;
  pkTeams: number;
  pkTeamMembers: number;
  pkKitsReceived: number;
  pkMembersOriented: number;
  totalLargeScaleClientsServed: number;
  totalPriorityLargeScalePatients: number;
  ls_nutrition?: number;
  ls_cancer?: number;
  ls_immunization?: number;
  ls_hpn?: number;
  ls_dm?: number;
  ls_maternal_health?: number;
  ls_road_safety?: number;
  ls_mental_health?: number;
  ls_tb?: number;
  ls_hiv?: number;
  ls_wash?: number;
  ls_health_promotion?: number;
  ls_fpe?: number;
  ls_philhealth?: number;
  ls_referral?: number;
  priorityProgramStats: Record<string, { target: number; served: number; percentage: number }>;
}

export interface DashboardStats {
  totalTarget: number;
  totalServed: number;
  totalPopulationReached: number;
  totalHealthPromotion: number;
  totalFPE: number;
  totalPhilHealth: number;
  totalReferral: number;
  totalWashTarget: number;
  totalWashServed: number;
  totalLargeScaleActivities?: number;
  totalPKActivities?: number;
  
  // New metrics
  totalMunicipalities?: number;
  totalTargetBarangays?: number;
  actualPopulation?: number;
  
  totalPuroks: number;
  totalPKTeams: number;
  totalPKTeamMembers: number;
  totalPKKitsReceived: number;
  totalPKMembersOriented: number;
  totalPKLargeScalePatients: number;
  totalPriorityLargeScalePatients: number;
  
  totalLargeScaleClientsServed: number;
  largeScaleProgramCounts: Record<string, number>;

  priorityProgramStats: Record<string, { target: number; served: number; percentage: number }>;

  municipalityStats: MunicipalityStat[];
  barangayStats?: BarangayStat[];

  monthlyTrends?: { month_name: string; month_date: string; served: number }[];
}

export type UserRole = 'ADMIN' | 'MUNICIPALITY' | 'VIEWER';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  municipality?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface DashboardData {
  patients: Patient[];
  totalCount: number;
  aggregates: DashboardStats;
}

export type DetailSource = "uwayapply" | "jinhakapply" | "unknown";

export interface UniversityMapping {
  name: string;
  category: string; // "4년제 수시" 등 목록 구분 컬럼
  region: string | null;
  foundedType: string | null; // 국·공립 | 사립
  status: string; // 접수중 | 접수예정 | 접수마감 | 준비중
  applyPeriodRaw: string | null; // "2026.09.07 ~ 2026.09.11"
  applyUrl: string | null;
  detailSource: DetailSource;
  detailUrl: string | null;
}

export interface DepartmentRatio {
  college: string | null;
  name: string;
  capacityRaw: string;
  capacity: number | null;
  applicants: number | null;
  ratio: number | null;
}

export interface AdmissionTypeRatio {
  name: string;
  quotaGroup: string | null;
  capacity: number | null;
  applicants: number | null;
  ratio: number | null;
  departments: DepartmentRatio[];
}

export interface UniversityRatioDetail {
  universityName: string;
  capturedAt: Date | null;
  capturedAtRaw: string | null;
  /** 사이트에 적힌 "경쟁률은 10분마다 업데이트/매일 10시·14시·17시 업데이트" 같은 안내 원문 */
  updateNotice: string | null;
  admissionTypes: AdmissionTypeRatio[];
}

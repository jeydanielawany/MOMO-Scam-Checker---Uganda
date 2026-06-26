export type ScamStatus = "SCAM" | "WARNING" | "SAFE";

export type TelecomOperator = "MTN" | "Airtel" | "Lyca" | "UTL" | "Unknown";

export interface PhoneRecord {
  number: string; // Cleaned format (e.g. "256772123456")
  originalFormat: string; // Human-readable format
  status: ScamStatus;
  reason: string;
  operator: TelecomOperator;
  reportedCount?: number;
  dateReported?: string;
}

export interface UserReport {
  id: string;
  number: string;
  status: ScamStatus;
  reason: string;
  operator: TelecomOperator;
  reportedAt: string;
  scamType: string;
  evidenceDescription?: string;
}

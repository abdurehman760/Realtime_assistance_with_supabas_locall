export interface SystemConfig {
  businessType: string;
  businessName: string;
  businessSummary: string;
  businessHours: {
    start: string;
    end: string;
  };
  serviceDuration: string;
  advanceBookingMonths: number;
  systemMessage?: string;
  assistantName: string; 
}

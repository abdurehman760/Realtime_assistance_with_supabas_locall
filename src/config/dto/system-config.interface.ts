export interface SystemConfig {
  businessType: string;
  businessName: string;
  businessSummary: string;  // Added business summary
  businessHours: {
    start: string;
    end: string;
  };
  serviceDuration: string;
  advanceBookingMonths: number;
}

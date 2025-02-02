import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import * as path from 'path';

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);
  private readonly sheets;
  private readonly SPREADSHEET_ID = '1NxowSHvTPnEifroS7RGkAsVO5EzrBvQe0dxNvX9liLk';

  constructor() {
    const keyFilePath = path.join(process.cwd(), 'service-account-key.json');
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.initializeSheet(); 
  }

  private async initializeSheet() {
    try {
      // Define headers for the sheet
      const headers = [
        'Name',
        'Appointment Time', // Changed from 'Date Time' to be more clear
        'Service',
        'Notes',
        'Phone Number',
        'Created At'
      ];

      // Check if headers exist and add them if they don't
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.SPREADSHEET_ID,
        range: 'Sheet1!A1:F1',
        valueInputOption: 'RAW',
        resource: {
          values: [headers]
        }
      });

      this.logger.log('Sheet headers initialized successfully');
    } catch (error) {
      this.logger.error(`Error initializing sheet headers: ${error.message}`);
    }
  }

  private formatDate(date: Date): string {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).replace(',', '') 
      .replace(' at ', ' at '); 
  }

  private formatTimeForSheet(datetimeStr: string): string {
    // Convert from "YYYY-MM-DD HH:mm" to "YYYY-MM-DD hh:mm AM/PM"
    const [date, time] = datetimeStr.split(' ');
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12; // Convert 24h to 12h format

    return `${date} ${hour12}:${minutes} ${ampm}`;
  }

  public async getBookedTimes(): Promise<string[]> {
    try {
      const range = 'Sheet1!B2:B'; // Appointment Time column
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.SPREADSHEET_ID,
        range,
      });

      // Return exactly what's in the sheet without any transformation
      const bookedTimes = (response.data.values || []).map(([datetime]) => datetime);

      this.logger.log(`Booked times retrieved: ${JSON.stringify(bookedTimes)}`);

      return bookedTimes;
    } catch (error) {
      this.logger.error(`Error fetching booked times: ${error.message}`);
      throw error;
    }
  }

  async scheduleAppointment(
    name: string,  // Changed from Name to name
    datetime: string,
    service: string,
    notes: string = '',
    phoneNumber: string = '', // Add phone number parameter
  ) {
    try {
      const formatteddatetime = this.formatTimeForSheet(datetime);
      const range = 'Sheet1!A2:F2'; // Updated range to include phone number column
      const now = new Date();
      const createdAt = this.formatDate(now); // Format the date
      
      // Maintain column order matching headers
      const values = [[
        name,    // Changed from Name to name
        formatteddatetime, // Use formatted datetime
        service,        // Column C: Service
        notes,          // Column D: Notes
        phoneNumber,    // Column E: Phone Number
        createdAt       // Column F: Created At
      ]];

      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.SPREADSHEET_ID,
        range,
        valueInputOption: 'RAW',
        resource: { values },
      });

      this.logger.log(`Appointment added successfully: ${JSON.stringify(values[0])}`);
      return {
        ...response.data,
        appointmentDetails: {
          name,  // Changed from Name to name
          datetime: formatteddatetime,
          service,
          notes,
          phoneNumber,
          createdAt,
        },
      };
    } catch (error) {
      this.logger.error(`Error adding appointment: ${error.message}`);
      throw error;
    }
  }
}

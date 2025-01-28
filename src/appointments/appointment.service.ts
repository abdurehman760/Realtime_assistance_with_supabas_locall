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
    this.initializeSheet(); // Add this line
  }

  private async initializeSheet() {
    try {
      // Define headers for the sheet
      const headers = [
        'Patient Name',
        'Date Time',
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
    });
  }

  public async getBookedTimes(): Promise<string[]> {
    try {
      const range = 'Sheet1!B2:B'; // DateTime column
      
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.SPREADSHEET_ID,
        range,
      });

      // Extract booked datetime strings
      const bookedTimes = (response.data.values || []).map(([dateTime]) => dateTime);

      // Log the booked times
      this.logger.log(`Booked times retrieved: ${JSON.stringify(bookedTimes)}`);

      return bookedTimes;
    } catch (error) {
      this.logger.error(`Error fetching booked times: ${error.message}`);
      throw error;
    }
  }

  async scheduleAppointment(
    patientName: string,
    dateTime: string,
    service: string,
    notes: string = '',
    phoneNumber: string = '', // Add phone number parameter
  ) {
    try {
      const range = 'Sheet1!A2:F2'; // Updated range to include phone number column
      const now = new Date();
      const createdAt = this.formatDate(now); // Format the date
      
      // Maintain column order matching headers
      const values = [[
        patientName,    // Column A: Patient Name
        dateTime,       // Column B: Date Time
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
          patientName,
          dateTime,
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

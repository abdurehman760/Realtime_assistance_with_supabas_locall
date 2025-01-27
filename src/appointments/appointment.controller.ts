import { Controller, Post, Body, HttpException, HttpStatus, Get } from '@nestjs/common';
import { AppointmentService } from './appointment.service';

interface AppointmentDto {
  patientName: string;
  dateTime: string;
  service: string;
  notes?: string;
  phoneNumber?: string; // Add optional phone number
  createdAt?: string; // Add optional createdAt field
}

@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Get('booked-times')
  async getBookedTimes() {
    try {
      const bookedTimes = await this.appointmentService.getBookedTimes();
      return {
        success: true,
        data: bookedTimes,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: 'Failed to fetch booked times',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('schedule')
  async scheduleAppointment(@Body() appointmentData: AppointmentDto) {
    try {
      const result = await this.appointmentService.scheduleAppointment(
        appointmentData.patientName,
        appointmentData.dateTime,
        appointmentData.service,
        appointmentData.notes,
        appointmentData.phoneNumber,
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Failed to schedule appointment',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
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

  @Post('schedule')
  async scheduleAppointment(@Body() appointmentData: AppointmentDto) {
    try {
      const result = await this.appointmentService.scheduleAppointment(
        appointmentData.patientName,
        appointmentData.dateTime,
        appointmentData.service,
        appointmentData.notes,
        appointmentData.phoneNumber, // Add phone number
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: 'Failed to schedule appointment',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

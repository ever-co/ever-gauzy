import { CrudController } from '../core';
import { AppointmentEmployees } from './appointment-employees.entity';
import { AppointmentEmployeesService } from './appointment-employees.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, UseGuards, HttpStatus, Get, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UUIDValidationPipe } from '../shared';

@ApiTags('appointment_employees')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class AppointmentEmployeesController extends CrudController<
	AppointmentEmployees
> {
	constructor(
		private appointmentEmployeesService: AppointmentEmployeesService
	) {
		super(appointmentEmployeesService);
	}

	@ApiOperation({ summary: 'Find appointment employees by appointment id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record',
		type: AppointmentEmployees
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(AuthGuard('jwt'))
	@Get(':appointmentid')
	async findOneById(
		@Param('appointmentid', UUIDValidationPipe) appointmentid: string
	): Promise<AppointmentEmployees[]> {
		return (
			await this.appointmentEmployeesService.findAll({
				where: {
					appointmentId: appointmentid
				}
			})
		).items;
	}
}

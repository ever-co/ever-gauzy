import { CrudController } from './../core/crud';
import { AppointmentEmployee } from './appointment-employees.entity';
import { AppointmentEmployeesService } from './appointment-employees.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, UseGuards, HttpStatus, Get, Param } from '@nestjs/common';
import { UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';

@ApiTags('AppointmentEmployee')
@UseGuards(TenantPermissionGuard)
@Controller()
export class AppointmentEmployeesController extends CrudController<AppointmentEmployee> {
	constructor(
		private appointmentEmployeesService: AppointmentEmployeesService
	) {
		super(appointmentEmployeesService);
	}

	@ApiOperation({ summary: 'Find appointment employees by appointment id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record',
		type: AppointmentEmployee
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':appointmentId')
	async findOneById(
		@Param('appointmentId', UUIDValidationPipe) appointmentId: string
	): Promise<AppointmentEmployee[]> {
		return (
			await this.appointmentEmployeesService.findAll({
				where: {
					appointmentId
				}
			})
		).items;
	}

	@ApiOperation({ summary: 'Find appointments based on employee id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records',
		type: AppointmentEmployee
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Records not found'
	})
	@Get('find-employee-appointments/:employeeId')
	async findEmployeeAppointments(
		@Param('employeeId', UUIDValidationPipe) employeeId: string
	): Promise<AppointmentEmployee[]> {
		return (
			await this.appointmentEmployeesService.findAll({
				where: {
					employeeId: employeeId
				},
				relations: ['employeeAppointment']
			})
		).items;
	}
}

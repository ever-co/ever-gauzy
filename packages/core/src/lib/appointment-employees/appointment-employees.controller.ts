import { CrudController } from './../core/crud';
import { AppointmentEmployee } from './appointment-employees.entity';
import { AppointmentEmployeesService } from './appointment-employees.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, UseGuards, HttpStatus, Get, Param } from '@nestjs/common';
import { IAppointmentEmployee } from '@gauzy/contracts';
import { UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';

@ApiTags('AppointmentEmployee')
@UseGuards(TenantPermissionGuard)
@Controller('/appointment-employees')
export class AppointmentEmployeesController extends CrudController<AppointmentEmployee> {
	constructor(private readonly appointmentEmployeesService: AppointmentEmployeesService) {
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
	@Get('appointment/:appointmentId')
	async findByAppointmentId(
		@Param('appointmentId', UUIDValidationPipe) appointmentId: string
	): Promise<IAppointmentEmployee[]> {
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
	@Get('employee-appointments/:employeeId')
	async findEmployeeAppointments(
		@Param('employeeId', UUIDValidationPipe) employeeId: string
	): Promise<IAppointmentEmployee[]> {
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

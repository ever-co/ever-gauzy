import { CrudController } from '../core';
import { AppointmentEmployee } from './appointment-employees.entity';
import { AppointmentEmployeesService } from './appointment-employees.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, UseGuards, HttpStatus, Get, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UUIDValidationPipe } from '../shared';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';

@ApiTags('AppointmentEmployee')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
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
	@UseGuards(AuthGuard('jwt'))
	@Get(':appointmentid')
	async findOneById(
		@Param('appointmentid', UUIDValidationPipe) appointmentid: string
	): Promise<AppointmentEmployee[]> {
		return (
			await this.appointmentEmployeesService.findAll({
				where: {
					appointmentId: appointmentid
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
	@UseGuards(AuthGuard('jwt'))
	@Get('findEmployeeAppointments/:employeeId')
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

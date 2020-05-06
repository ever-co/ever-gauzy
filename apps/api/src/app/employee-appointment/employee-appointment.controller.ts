import { CrudController, IPagination } from '../core';
import { EmployeeAppointment } from './employee-appointment.entity';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Controller,
	UseGuards,
	HttpStatus,
	Body,
	Param,
	Get,
	Post,
	Put,
	HttpCode
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { EmployeeAppointmentService } from './employee-appointment.service';
import { EmployeeAppointmentCreateCommand } from './commands/employee-appointment.create.command';
import { EmployeeAppointmentUpdateCommand } from './commands/employee-appointment.update.command';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('employee_appointment')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class EmployeeAppointmentController extends CrudController<
	EmployeeAppointment
> {
	constructor(
		private readonly employeeAppointmentService: EmployeeAppointmentService,
		private commandBus: CommandBus
	) {
		super(employeeAppointmentService);
	}

	@ApiOperation({
		summary: 'Find all employee appointments'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee appointments',
		type: EmployeeAppointmentService
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEmployeeAppointments(): Promise<
		IPagination<EmployeeAppointment>
	> {
		return this.employeeAppointmentService.findAllAppointments();
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/create')
	async createEmployeeAppointment(
		@Body() entity: EmployeeAppointment,
		...options: any[]
	) {
		return this.commandBus.execute(
			new EmployeeAppointmentCreateCommand(entity)
		);
	}

	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() entity: EmployeeAppointment
	): Promise<any> {
		return this.commandBus.execute(
			new EmployeeAppointmentUpdateCommand(id, entity)
		);
	}
}

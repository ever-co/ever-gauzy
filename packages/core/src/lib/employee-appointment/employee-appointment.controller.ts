import { Controller, UseGuards, HttpStatus, Body, Param, Get, Post, Put, HttpCode, Query } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { I18nLang } from 'nestjs-i18n';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	ID,
	LanguagesEnum,
	IEmployeeAppointmentCreateInput,
	IEmployeeAppointmentUpdateInput,
	IEmployeeAppointment,
	IPagination
} from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { RelationsQueryDTO } from '../shared/dto';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { EmployeeAppointmentService } from './employee-appointment.service';
import { EmployeeAppointmentCreateCommand, EmployeeAppointmentUpdateCommand } from './commands';
import { EmployeeAppointment } from './employee-appointment.entity';

@ApiTags('EmployeeAppointment')
@UseGuards(TenantPermissionGuard)
@Controller('/employee-appointment')
export class EmployeeAppointmentController extends CrudController<EmployeeAppointment> {
	constructor(
		private readonly employeeAppointmentService: EmployeeAppointmentService,
		private readonly commandBus: CommandBus
	) {
		super(employeeAppointmentService);
	}

	/**
	 * GET sign appointment
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Sign appointment id payload' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Token generated',
		type: String
	})
	@ApiResponse({
		status: HttpStatus.EXPECTATION_FAILED,
		description: 'Token generation failure'
	})
	@Get('/sign/:id')
	async signAppointment(@Param('id', UUIDValidationPipe) id: ID): Promise<string> {
		return this.employeeAppointmentService.signAppointmentId(id);
	}

	/**
	 * GET verify token
	 *
	 * @param token
	 * @returns
	 */
	@ApiOperation({ summary: 'Verify token' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Token verified',
		type: String
	})
	@ApiResponse({
		status: HttpStatus.EXPECTATION_FAILED,
		description: 'Token verification failure'
	})
	@Get('/decode/:token')
	async decodeToken(@Param('token') token: string): Promise<string> {
		const decoded = this.employeeAppointmentService.decodeSignToken(token);
		return decoded['appointmentId'];
	}

	/**
	 * GET employee appointment by pagination
	 *
	 * @param filter
	 * @returns
	 */
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	async pagination(
		@Query() filter: PaginationParams<EmployeeAppointment>
	): Promise<IPagination<IEmployeeAppointment>> {
		return this.employeeAppointmentService.paginate(filter);
	}

	/**
	 * GET all employee appointments
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all employee appointments'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee appointments',
		type: EmployeeAppointment
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/')
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IEmployeeAppointment>> {
		const { relations, findInput } = data;
		return this.employeeAppointmentService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * GET employee appointment by id
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Find Employee appointment by id.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record',
		type: EmployeeAppointment
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/:id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() query: RelationsQueryDTO
	): Promise<IEmployeeAppointment> {
		return await this.employeeAppointmentService.findById(id, query.relations);
	}

	/**
	 * CREATE employee create
	 *
	 * @param entity
	 * @param languageCode
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/')
	async create(
		@Body() entity: IEmployeeAppointmentCreateInput,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<IEmployeeAppointment> {
		return await this.commandBus.execute(new EmployeeAppointmentCreateCommand(entity, languageCode));
	}

	/**
	 * UPDATE employee appointment
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/:id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: IEmployeeAppointmentUpdateInput
	): Promise<IEmployeeAppointment> {
		return await this.commandBus.execute(new EmployeeAppointmentUpdateCommand(id, entity));
	}
}

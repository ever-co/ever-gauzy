import {
	Controller,
	UseGuards,
	HttpStatus,
	Body,
	Param,
	Get,
	Post,
	Put,
	HttpCode,
	Query,
	ValidationPipe,
	UsePipes
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { I18nLang } from 'nestjs-i18n';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	LanguagesEnum,
	IEmployeeAppointmentCreateInput,
	IEmployeeAppointmentUpdateInput,
	IEmployeeAppointment,
	IPagination
} from '@gauzy/contracts';
import { EmployeeAppointmentService } from './employee-appointment.service';
import {
	EmployeeAppointmentCreateCommand,
	EmployeeAppointmentUpdateCommand
} from './commands';
import { EmployeeAppointment } from './employee-appointment.entity';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { CrudController, PaginationParams } from './../core/crud';

@ApiTags('EmployeeAppointment')
@UseGuards(TenantPermissionGuard)
@Controller()
export class EmployeeAppointmentController extends CrudController<EmployeeAppointment> {
	constructor(
		private readonly employeeAppointmentService: EmployeeAppointmentService,
		private readonly commandBus: CommandBus
	) {
		super(employeeAppointmentService);
	}

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
	@Get('sign/:id')
	async signAppointment(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<string> {
		return this.employeeAppointmentService.signAppointmentId(id);
	}

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
	@Get('decode/:token')
	async decodeToken(
		@Param('token') token: string
	): Promise<string> {
		const decoded = this.employeeAppointmentService.decode(token);
		return decoded['appointmentId'];
	}

	@Get('pagination')
	@UsePipes(new ValidationPipe({ transform: true }))
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
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IEmployeeAppointment>> {
		const { relations, findInput } = data;
		return this.employeeAppointmentService.findAll({
			where: findInput,
			relations
		});
	}

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
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<IEmployeeAppointment> {
		return this.employeeAppointmentService.findOne(id);
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
	@Post()
	async create(
		@Body() entity: IEmployeeAppointmentCreateInput,
		@I18nLang() languageCode: LanguagesEnum
	): Promise<IEmployeeAppointment> {
		return await this.commandBus.execute(
			new EmployeeAppointmentCreateCommand(entity, languageCode)
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
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: IEmployeeAppointmentUpdateInput
	): Promise<IEmployeeAppointment> {
		return await this.commandBus.execute(
			new EmployeeAppointmentUpdateCommand(id, entity)
		);
	}
}

import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { ID, IPagination } from '@gauzy/contracts';
import { UseValidationPipe, UUIDValidationPipe } from '../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { CrudController, OptionParams, PaginationParams } from './../core/crud';
import { EmployeeSettingService } from './employee-setting.service';
import { EmployeeSetting } from './employee-setting.entity';
import { EmployeeSettingCreateCommand, EmployeeSettingUpdateCommand } from './commands';
import { CreateEmployeeSettingDTO, UpdateEmployeeSettingDTO } from './dto';

@ApiTags('EmployeeSetting')
@UseGuards(TenantPermissionGuard)
@Controller('/employee-settings')
export class EmployeeSettingController extends CrudController<EmployeeSetting> {
	constructor(
		private readonly employeeSettingService: EmployeeSettingService,
		private readonly commandBus: CommandBus
	) {
		super(employeeSettingService);
	}

	@ApiOperation({
		summary: 'Find all employee settings'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee settings',
		type: EmployeeSetting
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<EmployeeSetting>): Promise<IPagination<EmployeeSetting>> {
		return await this.employeeSettingService.findAll(params);
	}

	@ApiOperation({ summary: 'Find by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: ID,
		@Query() params: OptionParams<EmployeeSetting>
	): Promise<EmployeeSetting> {
		return this.employeeSettingService.findOneByIdString(id, params);
	}

	@ApiOperation({ summary: 'Create Employee Setting' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Post()
	@UseValidationPipe()
	async create(@Body() entity: CreateEmployeeSettingDTO): Promise<EmployeeSetting> {
		return await this.commandBus.execute(new EmployeeSettingCreateCommand(entity));
	}

	@ApiOperation({ summary: 'Update an existing employee setting' })
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
	@Put(':id')
	@UseValidationPipe()
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateEmployeeSettingDTO
	): Promise<EmployeeSetting> {
		return await this.commandBus.execute(new EmployeeSettingUpdateCommand(id, entity));
	}

	@ApiOperation({ summary: 'Delete Employee Setting' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.employeeSettingService.delete(id);
	}
}

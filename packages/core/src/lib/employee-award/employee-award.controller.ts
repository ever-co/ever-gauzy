import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Controller,
	HttpStatus,
	HttpCode,
	UseGuards,
	Post,
	Body,
	Put,
	Param,
	Delete,
	Query,
	Get
} from '@nestjs/common';
import { DeleteResult, UpdateResult } from 'typeorm';
import { IEmployeeAward, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { EmployeeAward } from './employee-award.entity';
import { EmployeeAwardService } from './employee-award.service';
import { CrudController, PaginationParams } from './../core/crud';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CreateEmployeeAwardDTO, UpdateEmployeeAwardDTO } from './dto';

@ApiTags('EmployeeAward')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.PUBLIC_PAGE_EDIT, PermissionsEnum.ALL_ORG_EDIT)
@Controller()
export class EmployeeAwardController extends CrudController<EmployeeAward> {
	constructor(private readonly employeeAwardService: EmployeeAwardService) {
		super(employeeAwardService);
	}

	@ApiOperation({
		summary: 'Find Employee Awards.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Employee Awards',
		type: EmployeeAward
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<EmployeeAward>): Promise<IPagination<IEmployeeAward>> {
		return await this.employeeAwardService.findAll({
			where: params.where
		});
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateEmployeeAwardDTO): Promise<IEmployeeAward> {
		return await this.employeeAwardService.create(entity);
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: IEmployeeAward['id'],
		@Body() entity: UpdateEmployeeAwardDTO
	): Promise<IEmployeeAward | UpdateResult> {
		return await this.employeeAwardService.update(id, entity);
	}

	@ApiOperation({ summary: 'Delete record' })
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
	async delete(@Param('id', UUIDValidationPipe) id: IEmployeeAward['id']): Promise<DeleteResult> {
		return await this.employeeAwardService.delete(id);
	}
}

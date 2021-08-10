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
import { CrudController } from './../core/crud';
import { EmployeeAward } from './employee-award.entity';
import { DeepPartial, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { EmployeeAwardService } from './employee-award.service';
import { TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { IEmployeeAward, IPagination } from '@gauzy/contracts';

@ApiTags('EmployeeAward')
@UseGuards(TenantPermissionGuard)
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
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IEmployeeAward>> {
		const { findInput } = data;
		return this.employeeAwardService.findAll({
			where: findInput
		});
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
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(
		@Body() entity: DeepPartial<EmployeeAward>
	): Promise<IEmployeeAward> {
		return this.employeeAwardService.create(entity);
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
		@Body() entity: QueryDeepPartialEntity<EmployeeAward>
	): Promise<IEmployeeAward | UpdateResult> {
		return this.employeeAwardService.update(id, entity);
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
	async delete(@Param('id', UUIDValidationPipe) id: string): Promise<any> {
		return this.employeeAwardService.delete(id);
	}
}

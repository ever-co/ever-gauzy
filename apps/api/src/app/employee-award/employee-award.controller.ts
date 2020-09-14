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
import { CrudController, IPagination } from '../core';
import { EmployeeAward } from './employee-award.entity';
import { AuthGuard } from '@nestjs/passport';
import { DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { EmployeeAwardService } from './employee-award.service';

@ApiTags('EmployeeAward')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class EmployeeAwardController extends CrudController<EmployeeAward> {
	constructor(private readonly employeeAwardService: EmployeeAwardService) {
		super(employeeAwardService);
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
	): Promise<EmployeeAward> {
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
		@Param('id') id: string,
		@Body() entity: QueryDeepPartialEntity<EmployeeAward>
	): Promise<any> {
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
	async delete(@Param('id') id: string): Promise<any> {
		return this.employeeAwardService.delete(id);
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
	async findAwardsByEmployeeId(
		@Query('data') data: string
	): Promise<IPagination<EmployeeAward>> {
		const { findInput } = JSON.parse(data);
		return this.employeeAwardService.findAll({
			where: findInput
		});
	}
}

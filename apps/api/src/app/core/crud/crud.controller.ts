// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import {
	Get,
	Post,
	Put,
	Delete,
	Body,
	Param,
	HttpStatus,
	HttpCode,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Base } from '../entities/base';
import { DeepPartial } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ICrudService } from './icrud.service';
import { IPagination } from './pagination';
import { PaginationParams } from './pagination-params';

@ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized' })
@ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden' })
@ApiBearerAuth()
export abstract class CrudController<T extends Base> {
	protected constructor(private readonly crudService: ICrudService<T>) {}

	@ApiOperation({ summary: 'find all' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records' /* type: IPagination<T> */,
	})
	@Get()
	async findAll(filter?: PaginationParams<T>): Promise<IPagination<T>> {
		return this.crudService.findAll(filter);
	}

	@ApiOperation({ summary: 'Find by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found one record' /*, type: T*/,
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found',
	})
	@Get(':id')
	async findById(@Param('id') id: string): Promise<T> {
		return this.crudService.findOne(id);
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/,
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong',
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(
		@Body() entity: DeepPartial<T>,
		...options: any[]
	): Promise<T> {
		return this.crudService.create(entity);
	}

	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found',
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong',
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id') id: string,
		@Body() entity: QueryDeepPartialEntity<T>,
		...options: any[]
	): Promise<any> {
		return this.crudService.update(id, entity); // FIXME: https://github.com/typeorm/typeorm/issues/1544
	}

	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'The record has been successfully deleted',
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found',
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id') id: string, ...options: any[]): Promise<any> {
		return this.crudService.delete(id);
	}
}

// Code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Get, Post, Put, Delete, Body, Param, HttpStatus, HttpCode, Query, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IPagination } from '@gauzy/contracts';
import { DeepPartial, FindOptionsWhere } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { BaseEntity } from '../entities/internal';
import { ICrudService } from './icrud.service';
import { PaginationParams } from './pagination-params';
import { AbstractValidationPipe, UUIDValidationPipe } from '../../shared/pipes';
import { TenantOrganizationBaseDTO } from '../../core/dto';

@ApiResponse({
	status: HttpStatus.UNAUTHORIZED,
	description: 'Unauthorized'
})
@ApiResponse({
	status: HttpStatus.FORBIDDEN,
	description: 'Forbidden'
})
@ApiBearerAuth()
export abstract class CrudController<T extends BaseEntity> {
	protected constructor(private readonly crudService: ICrudService<T>) {}

	/**
	 * Get the total count of all records.
	 *
	 * This endpoint retrieves the total count of all records for the given entity.
	 *
	 * @param options Optional query options for filtering records.
	 * @returns A promise resolving to the count of all records.
	 */
	@ApiOperation({ summary: 'Get total record count' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Total record count retrieved successfully'
	})
	@Get('count')
	async getCount(@Query() options?: FindOptionsWhere<T>): Promise<number | void> {
		return await this.crudService.countBy(options);
	}

	/**
	 * Get a paginated list of records.
	 *
	 * This endpoint retrieves a paginated list of records for the given entity.
	 *
	 * @param filter Optional filter parameters for pagination.
	 * @returns A promise resolving to a paginated list of records.
	 */
	@ApiOperation({ summary: 'Get paginated records' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Records retrieved successfully'
	})
	@Get('pagination')
	async pagination(@Query() filter?: PaginationParams<T>, ...options: any[]): Promise<IPagination<T> | void> {
		return this.crudService.paginate(filter);
	}

	/**
	 * Get all records.
	 *
	 * This endpoint retrieves all records for the given entity without pagination.
	 *
	 * @param filter Optional filter parameters for retrieval.
	 * @returns A promise resolving to all records.
	 */
	@ApiOperation({ summary: 'Get all records' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Records retrieved successfully'
	})
	@Get()
	async findAll(filter?: PaginationParams<T>, ...options: any[]): Promise<IPagination<T>> {
		return this.crudService.findAll(filter);
	}

	/**
	 * Get a record by ID.
	 *
	 * This endpoint retrieves a specific record by its ID.
	 *
	 * @param id The ID of the record to find.
	 * @returns A promise resolving to the found record.
	 */
	@ApiOperation({ summary: 'Find record by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Record retrieved successfully'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: T['id'], ...options: any[]): Promise<T> {
		return this.crudService.findOneByIdString(id);
	}

	/**
	 * Create a new record.
	 *
	 * This endpoint creates a new record for the given entity type.
	 *
	 * @param entity The data for the new record.
	 * @returns A promise resolving to the created record.
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Record created successfully'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input provided'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(@Body() entity: DeepPartial<T>, ...options: any[]): Promise<T> {
		return this.crudService.create(entity);
	}

	/**
	 * Update an existing record.
	 *
	 * This endpoint updates an existing record based on its ID and the given data.
	 *
	 * @param id The ID of the record to update.
	 * @param entity The data to update the record with.
	 * @returns A promise resolving to the updated record.
	 */
	@ApiOperation({ summary: 'Update existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Record updated successfully'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input provided for update'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: QueryDeepPartialEntity<T>,
		...options: any[]
	): Promise<any> {
		return this.crudService.update(id, entity); // FIXME: https://github.com/typeorm/typeorm/issues/1544
	}

	/**
	 * Delete a record.
	 *
	 * This endpoint deletes a specific record based on its ID.
	 *
	 * @param id The ID of the record to delete.
	 * @returns A promise resolving to the result of the delete operation.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'Record deleted successfully'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: string, ...options: any[]): Promise<any> {
		return this.crudService.delete(id);
	}

	/**
	 * Soft deletes a record by ID.
	 *
	 * This endpoint marks a record as deleted without physically removing it from the database.
	 * The soft-deleted record can be restored later.
	 *
	 * @param id The ID of the record to soft delete.
	 * @returns The soft-deleted record.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Record soft deleted successfully'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Delete(':id/soft')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: T['id'], ...options: any[]): Promise<T> {
		// Soft delete the record
		return await this.crudService.softRemove(id, options);
	}

	/**
	 * Restores a soft-deleted record by ID.
	 *
	 * This endpoint restores a record that was previously soft-deleted,
	 * allowing it to be used again in the application.
	 *
	 * @param id The ID of the record to restore.
	 * @returns The restored record.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Record restored successfully'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found or not in a soft-deleted state'
	})
	@Put(':id/recover')
	@HttpCode(HttpStatus.ACCEPTED)
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: T['id'], ...options: any[]): Promise<T> {
		// Restore the soft-deleted record
		return await this.crudService.softRecover(id, options);
	}
}

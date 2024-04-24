import { Body, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DeepPartial, DeleteResult, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IPagination } from '@gauzy/contracts';
import { Type } from '@gauzy/common';
import { BaseEntity } from './../../core/entities/base.entity';
import { TenantOrganizationBaseDTO } from '../../core/dto';
import { AbstractValidationPipe, UUIDValidationPipe } from './../../shared/pipes';
import { ICrudController } from './icrud.controller';
import { ICrudService } from './icrud.service';
import { PaginationParams } from './pagination-params';

/**
 * Base crud controller
 *
 * @param createDTO
 * @param updateDTO
 * @returns
 */
export function CrudFactory<BaseType, QueryType, CreateType, UpdateType, CountQueryType>(
	queryDTO?: Type<QueryType>,
	createDTO?: Type<CreateType>,
	updateDTO?: Type<UpdateType>,
	countQueryDTO?: Type<CountQueryType>
): Type<ICrudController<BaseType>> {
	class BaseCrudController<BaseType extends BaseEntity> implements ICrudController<BaseType> {
		constructor(public readonly crudService: ICrudService<BaseType>) { }

		/**
		 *
		 * @param options
		 * @returns
		 */
		@ApiOperation({ summary: 'Find records count.' })
		@ApiResponse({
			status: HttpStatus.OK,
			description: 'Found records count.'
		})
		@HttpCode(HttpStatus.OK)
		@Get('count')
		@UsePipes(new AbstractValidationPipe({ transform: true, whitelist: true }, { query: countQueryDTO }))
		async getCount(@Query() options?: FindOptionsWhere<BaseType>): Promise<number | void> {
			return await this.crudService.countBy(options);
		}

		/**
		 *
		 * @param filter
		 * @param options
		 * @returns
		 */
		@ApiOperation({ summary: 'Find all records using pagination.' })
		@ApiResponse({
			status: HttpStatus.OK,
			description: 'Found records using pagination.'
		})
		@HttpCode(HttpStatus.OK)
		@Get('pagination')
		@UsePipes(new AbstractValidationPipe({ transform: true, whitelist: true }, { query: queryDTO }))
		async pagination(
			@Query() filter?: PaginationParams<BaseType>,
			...options: any[]
		): Promise<IPagination<BaseType>> {
			return await this.crudService.paginate(filter);
		}

		/**
		 *
		 * @param filter
		 * @param options
		 * @returns
		 */
		@ApiOperation({ summary: 'Find all records.' })
		@ApiResponse({
			status: HttpStatus.OK,
			description: 'Found all records.'
		})
		@HttpCode(HttpStatus.OK)
		@Get()
		@UsePipes(new AbstractValidationPipe({ transform: true, whitelist: true }, { query: queryDTO }))
		async findAll(@Query() filter?: PaginationParams<BaseType>, ...options: any[]): Promise<IPagination<BaseType>> {
			return await this.crudService.findAll(filter);
		}

		/**
		 *
		 * @param id
		 * @param options
		 * @returns
		 */
		@ApiOperation({ summary: 'Find one record by id.' })
		@ApiResponse({
			status: HttpStatus.OK,
			description: 'Found one record by id.'
		})
		@ApiResponse({
			status: HttpStatus.NOT_FOUND,
			description: 'Record not found.'
		})
		@HttpCode(HttpStatus.OK)
		@Get(':id')
		async findById(@Param('id', UUIDValidationPipe) id: BaseType['id'], ...options: any[]): Promise<BaseType> {
			return await this.crudService.findOneByIdString(id);
		}

		/**
		 *
		 * @param entity
		 * @returns
		 */
		@ApiOperation({ summary: 'Create new record.' })
		@ApiResponse({
			status: HttpStatus.CREATED,
			description: 'The record has been successfully created.'
		})
		@ApiResponse({
			status: HttpStatus.BAD_REQUEST,
			description: 'Invalid input, The response body may contain clues as to what went wrong.'
		})
		@HttpCode(HttpStatus.CREATED)
		@Post()
		@UsePipes(new AbstractValidationPipe({ transform: true, whitelist: true }, { body: createDTO }))
		async create(@Body() entity: DeepPartial<BaseType>): Promise<BaseType> {
			return await this.crudService.create(entity);
		}

		/**
		 *
		 * @param id
		 * @param entity
		 * @returns
		 */
		@ApiOperation({ summary: 'Update an existing record.' })
		@ApiResponse({
			status: HttpStatus.ACCEPTED,
			description: 'The record has been successfully edited.'
		})
		@ApiResponse({
			status: HttpStatus.NOT_FOUND,
			description: 'Record not found'
		})
		@ApiResponse({
			status: HttpStatus.BAD_REQUEST,
			description: 'Invalid input, The response body may contain clues as to what went wrong.'
		})
		@HttpCode(HttpStatus.ACCEPTED)
		@Put(':id')
		@UsePipes(new AbstractValidationPipe({ transform: true, whitelist: true }, { body: updateDTO }))
		async update(
			@Param('id', UUIDValidationPipe) id: BaseType['id'],
			@Body() entity: QueryDeepPartialEntity<BaseType>
		): Promise<BaseType | UpdateResult> {
			return await this.crudService.update(id, entity);
		}

		/**
		 *
		 * @param id
		 * @returns
		 */
		@ApiOperation({ summary: 'Delete record.' })
		@ApiResponse({
			status: HttpStatus.ACCEPTED,
			description: 'The record has been successfully deleted.'
		})
		@ApiResponse({
			status: HttpStatus.NOT_FOUND,
			description: 'Record not found.'
		})
		@HttpCode(HttpStatus.ACCEPTED)
		@Delete(':id')
		async delete(@Param('id', UUIDValidationPipe) id: BaseType['id']): Promise<DeleteResult> {
			return await this.crudService.delete(id);
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
			description: 'Record soft deleted successfully',
		})
		@ApiResponse({
			status: HttpStatus.NOT_FOUND,
			description: 'Record not found',
		})
		@Delete(':id/soft')
		@HttpCode(HttpStatus.ACCEPTED)
		@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
		async softRemove(
			@Param('id', UUIDValidationPipe) id: BaseType['id'],
			...options: any[]
		): Promise<BaseType> {
			// Find the record by ID
			const entity = await this.crudService.findOneByIdString(id);
			// Soft delete the record
			return await this.crudService.softRemove(entity, options);
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
			description: 'Record restored successfully',
		})
		@ApiResponse({
			status: HttpStatus.NOT_FOUND,
			description: 'Record not found or not in a soft-deleted state',
		})
		@Put(':id/recover')
		@HttpCode(HttpStatus.ACCEPTED)
		@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
		async softRecover(
			@Param('id', UUIDValidationPipe) id: BaseType['id'],
			...options: any[]
		): Promise<BaseType> {
			// Find the soft-deleted record by ID
			const entity = await this.crudService.findOneByIdString(id);
			// Restore the soft-deleted record
			return await this.crudService.softRecover(entity, options);
		}
	}
	return BaseCrudController;
}

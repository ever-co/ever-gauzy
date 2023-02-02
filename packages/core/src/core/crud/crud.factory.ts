import { IPagination } from '@gauzy/contracts';
import { Body, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, Type, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DeepPartial, DeleteResult, FindOptionsWhere, UpdateResult } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { BaseEntity } from './../../core/entities/base.entity';
import { AbstractValidationPipe, UUIDValidationPipe } from './../../shared/pipes';
import { ConstructorType, ICrudController } from './icrud.controller';
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
): ConstructorType<ICrudController<BaseType>> {
	class BaseCrudController<BaseType extends BaseEntity> implements ICrudController<BaseType> {
		constructor(public readonly crudService: ICrudService<BaseType>) {}

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
	}
	return BaseCrudController;
}

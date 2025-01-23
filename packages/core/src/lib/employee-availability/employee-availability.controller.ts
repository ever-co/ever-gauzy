import { UpdateResult } from 'typeorm';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IEmployeeAvailability, IEmployeeAvailabilityCreateInput, IPagination } from '@gauzy/contracts';
import { EmployeeAvailabilityService } from './employee-availability.service';
import { EmployeeAvailability } from './employee-availability.entity';
import { CrudController, PaginationParams } from '../core';
import { TenantPermissionGuard, UUIDValidationPipe } from '../shared';
import { EmployeeAvailabilityBulkCreateCommand, EmployeeAvailabilityCreateCommand } from './commands';
import { CreateEmployeeAvailabilityDTO } from './dto/create-employee-availability.dto';
import { UpdateEmployeeAvailabilityDTO } from './dto/update-employee-availability.dto';

@ApiTags('EmployeeAvailability')
@UseGuards(TenantPermissionGuard)
@Controller('/employee-availability')
export class EmployeeAvailabilityController extends CrudController<EmployeeAvailability> {
	constructor(
		private readonly availabilityService: EmployeeAvailabilityService,
		private readonly commandBus: CommandBus
	) {
		super(availabilityService);
	}

	/**
	 * Create multiple employee availability records in bulk.
	 *
	 * @param entities List of availability records to create
	 * @returns The created availability records
	 */
	@ApiOperation({ summary: 'Create multiple availability records' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The records have been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post('/bulk')
	async createBulk(@Body() entities: CreateEmployeeAvailabilityDTO[]): Promise<IEmployeeAvailability[]> {
		return await this.commandBus.execute(new EmployeeAvailabilityBulkCreateCommand(entities));
	}

	/**
	 * Retrieve all employee availability records.
	 *
	 * @param data Query parameters, including relations and filters
	 * @returns A paginated list of availability records
	 */
	@ApiOperation({ summary: 'Retrieve all availability records' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved availability records.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No availability records found.'
	})
	@Get()
	async findAll(
		@Query() filter: PaginationParams<EmployeeAvailability>
	): Promise<IPagination<IEmployeeAvailability>> {
		return this.availabilityService.findAll(filter);
	}

	/**
	 * Create a new employee availability record.
	 *
	 * @param entity The data for the new availability record
	 * @returns The created availability record
	 */
	@ApiOperation({ summary: 'Create a new availability record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post()
	async create(@Body() entity: CreateEmployeeAvailabilityDTO): Promise<IEmployeeAvailability> {
		return await this.commandBus.execute(new EmployeeAvailabilityCreateCommand(entity));
	}

	/**
	 * Update an existing employee availability record by its ID.
	 *
	 * @param id The ID of the availability record
	 * @param entity The updated data for the record
	 * @returns The updated availability record
	 */
	@ApiOperation({ summary: 'Update an existing availability record' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The record has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateEmployeeAvailabilityDTO
	): Promise<IEmployeeAvailability | UpdateResult> {
		return this.availabilityService.update(id, { ...entity });
	}
}

import {
	Controller,
	Get,
	Param,
	UseGuards,
	Query,
	Body,
	Post,
	Put,
	BadRequestException,
	Delete,
	HttpCode,
	HttpStatus,
	UsePipes
} from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IEmployeeLevel, IPagination, ID, PermissionsEnum } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { EmployeeLevel } from './employee-level.entity';
import { EmployeeLevelService } from './employee-level.service';
import { TenantPermissionGuard, PermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe, AbstractValidationPipe } from './../shared/pipes';
import { Permissions } from '../shared/decorators';
import { TenantOrganizationBaseDTO } from '../core/dto';

@ApiTags('EmployeeLevel')
@UseGuards(TenantPermissionGuard)
@Controller('/employee-level')
export class EmployeeLevelController extends CrudController<EmployeeLevel> {
	constructor(private readonly employeeLevelService: EmployeeLevelService) {
		super(employeeLevelService);
	}

	@Get()
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IEmployeeLevel>> {
		const { relations, findInput } = data;
		return await this.employeeLevelService.findAll({
			where: {
				...findInput
			},
			relations
		});
	}

	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: EmployeeLevel,
		...options: any[]
	): Promise<IEmployeeLevel> {
		try {
			return this.employeeLevelService.create({ ...entity, id });
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * Creates an employee level.
	 *
	 * Overrides the inherited `CrudController.create()` route only to attach a permission. The base declares the
	 * route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of
	 * the tenant could write the organization's employee levels. It now states `ALL_ORG_EDIT`, the grant its soft
	 * delete and recovery state (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param entity The record to create.
	 * @param options The inherited options, forwarded to the base route.
	 * @returns The created record.
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Record created successfully' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input provided' })
	@HttpCode(HttpStatus.CREATED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Post()
	async create(@Body() entity: DeepPartial<EmployeeLevel>, ...options: any[]): Promise<EmployeeLevel> {
		return await super.create(entity, ...options);
	}

	/**
	 * Deletes an employee level.
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach a permission, for the reason `create`
	 * gives: `ALL_ORG_EDIT` (GHSA-v79w-54p2-wmh5).
	 *
	 * @param id The record to delete.
	 * @param options The inherited options, forwarded to the base route.
	 * @returns The store's delete result, as the base route answers it.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Record deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.delete(id, ...options);
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could retire the row. It now states `ALL_ORG_EDIT`: the organization-settings edit grant
	 * (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted record.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<EmployeeLevel> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could restore the row. It now states `ALL_ORG_EDIT`: the organization-settings edit grant
	 * (GHSA-v79w-54p2-wmh5). The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored record.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<EmployeeLevel> {
		return await super.softRecover(id, ...options);
	}
}

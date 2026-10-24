import { Controller, HttpStatus, Get, HttpCode, UseGuards, Put, Param, Body, Query, Post, Delete, UsePipes } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ID, IEquipmentSharing, IPagination, PermissionsEnum, RequestApprovalStatusTypesEnum } from '@gauzy/contracts';
import { CrudController, BaseQueryDTO } from './../core/crud';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingService } from './equipment-sharing.service';

import {
	EquipmentSharingStatusCommand,
	EquipmentSharingCreateCommand,
	EquipmentSharingUpdateCommand
} from './commands';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe, AbstractValidationPipe } from './../shared/pipes';
import { Permissions } from './../shared/decorators';
import { TenantOrganizationBaseDTO } from '../core/dto';

@ApiTags('EquipmentSharing')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/equipment-sharing')
export class EquipmentSharingController extends CrudController<EquipmentSharing> {
	constructor(private readonly equipmentSharingService: EquipmentSharingService, private commandBus: CommandBus) {
		super(equipmentSharingService);
	}

	/**
	 * GET equipment sharings by organization id
	 *
	 * @param orgId
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find equipment sharings By Organization Id'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found equipment sharings',
		type: EquipmentSharing
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW)
	@Get('/organization/:id')
	async findEquipmentSharingsByOrganizationId(
		@Param('id', UUIDValidationPipe) organizationId: ID
	): Promise<IPagination<IEquipmentSharing>> {
		return this.equipmentSharingService.findEquipmentSharingsByOrganizationId(organizationId);
	}

	/**
	 * GET equipment sharings by employee id
	 *
	 * @param employeeId
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find equipment sharings By Employee Id'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found equipment sharings',
		type: EquipmentSharing
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW)
	@Get('/employee/:id')
	async findEquipmentSharingsByEmployeeId(
		@Param('id', UUIDValidationPipe) employeeId: ID
	): Promise<IPagination<IEquipmentSharing>> {
		return this.equipmentSharingService.findEquipmentSharingsByEmployeeId(employeeId);
	}

	/**
	 * CREATE equipment sharing
	 *
	 * @param organizationId
	 * @param equipmentSharing
	 * @returns
	 */
	@ApiOperation({ summary: 'Create an new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.'
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EQUIPMENT_MAKE_REQUEST, PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT)
	@Post('/organization/:id')
	async createEquipmentSharing(
		@Param('id', UUIDValidationPipe) organizationId: ID,
		@Body() entity: EquipmentSharing
	): Promise<IEquipmentSharing> {
		return await this.commandBus.execute(new EquipmentSharingCreateCommand(organizationId, entity));
	}

	/**
	 * UPDATE equipment sharings request approval
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'equipment sharings request approval' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found equipment sharings',
		type: EquipmentSharing
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EQUIPMENT_APPROVE_REQUEST, PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT)
	@Put('/approval/:id')
	async equipmentSharingsRequestApproval(@Param('id', UUIDValidationPipe) id: ID): Promise<IEquipmentSharing> {
		return await this.commandBus.execute(
			new EquipmentSharingStatusCommand(id, RequestApprovalStatusTypesEnum.APPROVED)
		);
	}

	/**
	 * UPDATE equipment sharings request refuse
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'equipment sharings request refuse' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found equipment sharings',
		type: EquipmentSharing
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EQUIPMENT_APPROVE_REQUEST, PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT)
	@Put('/refuse/:id')
	async equipmentSharingsRequestRefuse(@Param('id', UUIDValidationPipe) id: ID): Promise<IEquipmentSharing> {
		return this.commandBus.execute(new EquipmentSharingStatusCommand(id, RequestApprovalStatusTypesEnum.REFUSED));
	}

	/**
	 * GET equipment sharing by pagination
	 *
	 * @param filter
	 * @returns
	 */
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW)
	@UseValidationPipe({ transform: true })
	@Get('/pagination')
	async pagination(@Query() filter: BaseQueryDTO<EquipmentSharing>): Promise<IPagination<IEquipmentSharing>> {
		return this.equipmentSharingService.pagination(filter);
	}

	/**
	 * GET all equipment sharings
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all equipment sharings'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found equipment sharings',
		type: EquipmentSharing
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW)
	@Get('/')
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IEquipmentSharing>> {
		const { relations = [], findInput } = data;
		return this.equipmentSharingService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 * UPDATE equipment sharing by id
	 *
	 * @param id
	 * @param equipmentSharing
	 * @returns
	 */
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
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EQUIPMENT_APPROVE_REQUEST, PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT)
	@Put('/:id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() equipmentSharing: EquipmentSharing
	): Promise<IEquipmentSharing> {
		return await this.commandBus.execute(new EquipmentSharingUpdateCommand(id, equipmentSharing));
	}

	/**
	 * Creates a record from the raw body — the `POST /equipment-sharing` route the CRUD base maps.
	 *
	 * Overrides the inherited `CrudController.create()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the tenant
	 * could store a sharing of any status with no approval row beside it, around `POST /organization/:id` (which files
	 * the request the UI makes). It now states `EQUIPMENT_APPROVE_REQUEST` or `ORG_EQUIPMENT_SHARING_EDIT`: the grants
	 * that may decide a sharing (GHSA-v79w-54p2-wmh5).
	 *
	 * The equipment and the policy the body names are held to the rule the filing and the edit apply: they must be
	 * rows of the organization the record is stored in, in either form the body names them — the column or the
	 * related object. Nothing checked them here, so this route could point a sharing at another organization's
	 * equipment or policy. That organization is the body's (`organizationId` or `organization: { id }`), else that of
	 * the stored row a body-supplied id names (the base's create is an upsert by id), else the caller's, and the row
	 * is stored in the organization it was checked in (`EquipmentSharingService.assertCreateIsInScope`).
	 *
	 * @param entity The record to store.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The created record.
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Record created successfully' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input provided' })
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.EQUIPMENT_APPROVE_REQUEST, PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT)
	@Post()
	async create(@Body() entity: EquipmentSharing, ...options: any[]): Promise<EquipmentSharing> {
		const values = await this.equipmentSharingService.assertCreateIsInScope(entity ?? ({} as EquipmentSharing));
		return await super.create(values as EquipmentSharing, ...options);
	}

	/**
	 * Deletes a record and its approval row by id.
	 *
	 * Overrides the inherited `CrudController.delete()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the tenant
	 * could remove anyone's sharing, approved ones included. It now states `EQUIPMENT_APPROVE_REQUEST` or
	 * `ORG_EQUIPMENT_SHARING_EDIT`, like the retire-and-restore pair (GHSA-v79w-54p2-wmh5). The GraphQL field that
	 * mirrors it states the same.
	 *
	 * @param id The record to delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The delete result.
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.EQUIPMENT_APPROVE_REQUEST, PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<any> {
		return await super.delete(id, ...options);
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could retire the row. It now states `EQUIPMENT_APPROVE_REQUEST` or
	 * `ORG_EQUIPMENT_SHARING_EDIT`: the grants its update, approve and refuse routes state (GHSA-v79w-54p2-wmh5).
	 * The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted record.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.EQUIPMENT_APPROVE_REQUEST, PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<EquipmentSharing> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares
	 * the route with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member
	 * of the tenant could restore the row. It now states `EQUIPMENT_APPROVE_REQUEST` or
	 * `ORG_EQUIPMENT_SHARING_EDIT`: the grants its update, approve and refuse routes state (GHSA-v79w-54p2-wmh5).
	 * The GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored record.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.EQUIPMENT_APPROVE_REQUEST, PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<EquipmentSharing> {
		return await super.softRecover(id, ...options);
	}
}

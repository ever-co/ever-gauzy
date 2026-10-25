import { Controller, HttpStatus, Get, HttpCode, UseGuards, Put, Param, Body, Query, Post, Delete, UsePipes } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	ID,
	IEquipmentSharing,
	IEquipmentSharingUpdateInPlaceInput,
	IPagination,
	PermissionsEnum,
	RequestApprovalStatusTypesEnum
} from '@gauzy/contracts';
import { CrudController, BaseQueryDTO } from './../core/crud';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingService } from './equipment-sharing.service';

import {
	EquipmentSharingStatusCommand,
	EquipmentSharingCreateCommand,
	EquipmentSharingUpdateCommand,
	EquipmentSharingUpdateInPlaceCommand
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
	 * UPDATE equipment sharing by id, in place and at the version the edit is based on.
	 *
	 * `PUT /:id` above removes the row and files it again (its documented contract, kept as it is). This route writes
	 * the row where it is, in one statement predicated on the body's `version` (required), and is refused with 409
	 * `ENTITY_VERSION_CONFLICT` when the stored row has moved on. A member the body leaves out keeps its stored value;
	 * `employees` / `teams`, when stated, replace the memberships. Same permission and scope checks as `PUT /:id`: the
	 * row is read in the caller's scope (404 otherwise), and the equipment, the policy, the employees and the teams the
	 * body names must be the row's organization's.
	 *
	 * @param id The sharing.
	 * @param equipmentSharing The edit, with the version it is based on.
	 * @returns The sharing, as written.
	 */
	@ApiOperation({ summary: 'Update an existing record in place, at the version the edit is based on' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'The record has been successfully edited in place.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.CONFLICT,
		description: 'The record changed since the version the edit is based on (ENTITY_VERSION_CONFLICT)'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input (a missing or malformed version among them), The response body may contain clues'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.EQUIPMENT_APPROVE_REQUEST, PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT)
	@Put('/:id/in-place')
	async updateInPlace(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() equipmentSharing: EquipmentSharing
	): Promise<IEquipmentSharing> {
		const input = equipmentSharing as unknown as IEquipmentSharingUpdateInPlaceInput;
		return await this.commandBus.execute(new EquipmentSharingUpdateInPlaceCommand(id, input));
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
	 * is stored with exactly the organization, equipment and policy that were checked, none of them left for the
	 * upsert to keep from the stored row (`EquipmentSharingService.assertCreateIsInScope`).
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
		// Checked as the row it stores; a body naming a stored sharing is an edit, a compare-and-set on its version
		// (the body's `version`, else the one the check read), and is refused with 409 when the row has moved on.
		return await this.equipmentSharingService.storeCreate(entity ?? ({} as EquipmentSharing), (values) =>
			super.create(values as EquipmentSharing, ...options)
		);
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

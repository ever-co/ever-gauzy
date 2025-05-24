import { Controller, HttpStatus, Get, HttpCode, UseGuards, Put, Param, Body, Query, Post } from '@nestjs/common';
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
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { Permissions } from './../shared/decorators';

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
}

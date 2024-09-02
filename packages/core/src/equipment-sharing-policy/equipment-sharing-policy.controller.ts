import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, HttpStatus, Get, UseGuards, Put, Param, Body, Query, Post } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { ID, IEquipmentSharingPolicy, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { Permissions } from './../shared/decorators';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';
import { EquipmentSharingPolicyService } from './equipment-sharing-policy.service';

@ApiTags('EquipmentSharingPolicy')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT)
@Controller('/equipment-sharing-policy')
export class EquipmentSharingPolicyController extends CrudController<EquipmentSharingPolicy> {
	constructor(readonly equipmentSharingPolicyService: EquipmentSharingPolicyService) {
		super(equipmentSharingPolicyService);
	}

	/**
	 * GET equipment sharing policy by pagination
	 *
	 * @param filter
	 * @returns
	 */
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.EQUIPMENT_SHARING_POLICY_VIEW)
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	async pagination(
		@Query() filter: PaginationParams<EquipmentSharingPolicy>
	): Promise<IPagination<IEquipmentSharingPolicy>> {
		return this.equipmentSharingPolicyService.paginate(filter);
	}

	@ApiOperation({ summary: 'Find all policies.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: EquipmentSharingPolicy
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.EQUIPMENT_SHARING_POLICY_VIEW)
	@Get('/')
	async findAll(@Query('data', ParseJsonPipe) data: any): Promise<IPagination<IEquipmentSharingPolicy>> {
		const { findInput, relations } = data;
		return this.equipmentSharingPolicyService.findAll({
			where: findInput,
			relations
		});
	}

	/**
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.EQUIPMENT_SHARING_POLICY_ADD)
	@Post('/')
	async create(@Body() entity: EquipmentSharingPolicy): Promise<IEquipmentSharingPolicy> {
		return await this.equipmentSharingPolicyService.create(entity);
	}

	/**
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT)
	@Put('/:id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: EquipmentSharingPolicy
	): Promise<IEquipmentSharingPolicy | UpdateResult> {
		return await this.equipmentSharingPolicyService.update(id, entity);
	}
}

import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Controller, HttpStatus, Get, UseGuards, Put, Param, Body, Query, Post } from '@nestjs/common';
import { UpdateResult } from 'typeorm';
import { ID, IEquipmentSharingPolicy, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from './../core/crud';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { Permissions } from './../shared/decorators';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';
import { EquipmentSharingPolicyService } from './equipment-sharing-policy.service';
import { UpdateOrCreateEquipmentSharingPolicyDTO } from './dto/update-or-create.dto';

@ApiTags('EquipmentSharingPolicy')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT)
@Controller('/equipment-sharing-policy')
export class EquipmentSharingPolicyController extends CrudController<EquipmentSharingPolicy> {
	constructor(readonly equipmentSharingPolicyService: EquipmentSharingPolicyService) {
		super(equipmentSharingPolicyService);
	}

	/**
	 * GET equipment sharing policies by pagination.
	 *
	 * @param filter The pagination filter parameters.
	 * @returns A paginated list of equipment sharing policies.
	 */
	@ApiOperation({ summary: 'Get equipment sharing policies by pagination' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Paginated list of equipment sharing policies retrieved successfully.',
		type: EquipmentSharingPolicy
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.EQUIPMENT_SHARING_POLICY_VIEW)
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	async pagination(
		@Query() filter: PaginationParams<EquipmentSharingPolicy>
	): Promise<IPagination<IEquipmentSharingPolicy>> {
		return await this.equipmentSharingPolicyService.paginate(filter);
	}

	/**
	 * Find all equipment sharing policies.
	 *
	 * @param params The pagination and filtering parameters.
	 * @returns A list of equipment sharing policies.
	 */
	@ApiOperation({ summary: 'Find all equipment sharing policies' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Equipment sharing policies found.',
		type: EquipmentSharingPolicy
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No equipment sharing policies found.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.EQUIPMENT_SHARING_POLICY_VIEW)
	@Get('/')
	async findAll(
		@Query() params: PaginationParams<EquipmentSharingPolicy>
	): Promise<IPagination<IEquipmentSharingPolicy>> {
		return await this.equipmentSharingPolicyService.findAll(params);
	}

	/**
	 * Create a new Equipment Sharing Policy record.
	 *
	 * @param entity The EquipmentSharingPolicy object to create.
	 * @returns The created EquipmentSharingPolicy object.
	 */
	@ApiOperation({ summary: 'Create a new Equipment Sharing Policy record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The Equipment Sharing Policy has been successfully created.',
		type: EquipmentSharingPolicy
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.EQUIPMENT_SHARING_POLICY_ADD)
	@Post('/')
	@UseValidationPipe()
	async create(@Body() entity: UpdateOrCreateEquipmentSharingPolicyDTO): Promise<IEquipmentSharingPolicy> {
		return await this.equipmentSharingPolicyService.create(entity);
	}

	/**
	 * Update an existing Equipment Sharing Policy record.
	 *
	 * @param id The ID of the EquipmentSharingPolicy to update.
	 * @param entity The updated EquipmentSharingPolicy object.
	 * @returns The updated EquipmentSharingPolicy object or the update result.
	 */
	@ApiOperation({ summary: 'Update an existing Equipment Sharing Policy record' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The Equipment Sharing Policy has been successfully updated.',
		type: EquipmentSharingPolicy
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'The Equipment Sharing Policy with the given ID was not found.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.EQUIPMENT_SHARING_POLICY_EDIT)
	@Put('/:id')
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateOrCreateEquipmentSharingPolicyDTO
	): Promise<IEquipmentSharingPolicy | UpdateResult> {
		return await this.equipmentSharingPolicyService.update(id, entity);
	}
}

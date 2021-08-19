import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	Controller,
	HttpStatus,
	Get,
	HttpCode,
	UseGuards,
	Put,
	Param,
	Body,
	Query,
	Post
} from '@nestjs/common';
import { IEquipmentSharingPolicy, IPagination } from '@gauzy/contracts';
import { CrudController } from './../core/crud';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';
import { EquipmentSharingPolicyService } from './equipment-sharing-policy.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('EquipmentSharingPolicy')
@UseGuards(TenantPermissionGuard)
@Controller()
export class EquipmentSharingPolicyController extends CrudController<EquipmentSharingPolicy> {
	constructor(
		private readonly equipmentSharingPolicyService: EquipmentSharingPolicyService
	) {
		super(equipmentSharingPolicyService);
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
	@UseGuards(PermissionGuard)
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IEquipmentSharingPolicy>> {
		const { findInput, relations } = data;
		return this.equipmentSharingPolicyService.findAll({
			where: findInput,
			relations
		});
	}

	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Post()
	async create(
		@Body() entity: IEquipmentSharingPolicy
	): Promise<IEquipmentSharingPolicy> {
		return this.equipmentSharingPolicyService.create(entity);
	}

	@ApiOperation({ summary: 'Update record' })
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: IEquipmentSharingPolicy
	): Promise<IEquipmentSharingPolicy> {
		return this.equipmentSharingPolicyService.update(id, entity);
	}
}

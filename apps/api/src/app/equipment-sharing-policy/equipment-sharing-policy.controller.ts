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
import { CrudController } from '../core';
import { AuthGuard } from '@nestjs/passport';
import { EquipmentSharingPolicy as IEquipmentSharingPolicy } from '@gauzy/models';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { EquipmentSharingPolicyService } from './equipment-sharing-policy.service';

@ApiTags('EquipmentSharingPolicy')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class EquipmentSharingPolicyController extends CrudController<
	EquipmentSharingPolicy
> {
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
	findAllEquipmentSharingPolicies(@Query('data') data: string): any {
		const { findInput, relations } = JSON.parse(data);

		return this.equipmentSharingPolicyService.findAllPolicies({
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
	@Post('')
	async createEquipmentSharingPolicy(
		@Body() entity: IEquipmentSharingPolicy
	): Promise<EquipmentSharingPolicy> {
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
	async updateEquipmentSharingPolicy(
		@Param('id') id: string,
		@Body() entity: IEquipmentSharingPolicy
	): Promise<EquipmentSharingPolicy> {
		return this.equipmentSharingPolicyService.update(id, entity);
	}
}

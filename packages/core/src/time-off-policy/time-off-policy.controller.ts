import {
	Controller,
	HttpStatus,
	Post,
	Body,
	Get,
	Query,
	Put,
	Param,
	HttpCode,
	UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Permissions } from './../shared/decorators';
import { CrudController } from '../core/crud/crud.controller';
import { TimeOffPolicy } from './time-off-policy.entity';
import {
	ITimeOffPolicyCreateInput,
	ITimeOffPolicyUpdateInput,
	ITimeOffPolicy,
	PermissionsEnum
} from '@gauzy/contracts';
import { AuthGuard } from '@nestjs/passport';
import { IPagination } from '../core';
import { TimeOffPolicyService } from './time-off-policy.service';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('TimeOffPolicy')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class TimeOffPolicyController extends CrudController<TimeOffPolicy> {
	constructor(private readonly policyService: TimeOffPolicyService) {
		super(policyService);
	}

	@ApiOperation({ summary: 'Find all policies.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: TimeOffPolicy
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.POLICY_VIEW)
	@Get()
	async findAllTimeOffPolicies(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<ITimeOffPolicy>> {
		const { relations, findInput } = data;
		return this.policyService.findAll({
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
	@Permissions(PermissionsEnum.POLICY_EDIT)
	@Post('/create')
	async createTimeOffPolicy(
		@Body() entity: ITimeOffPolicyCreateInput,
		...options: any[]
	): Promise<ITimeOffPolicy> {
		return this.policyService.create(entity);
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
	@Permissions(PermissionsEnum.POLICY_EDIT)
	@Put(':id')
	async updateOrganizationTeam(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: ITimeOffPolicyUpdateInput,
		...options: any[]
	): Promise<ITimeOffPolicy> {
		return this.policyService.update(id, entity);
	}
}

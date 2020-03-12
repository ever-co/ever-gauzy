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
import { Permissions } from '../shared/decorators/permissions';
import { CrudController } from '../core/crud/crud.controller';
import { TimeOffPolicy } from './time-off-policy.entity';
import {
	TimeOffPolicyCreateInput as ITimeOffPolicyCreateInput,
	TimeOffPolicyUpdateInput as ITimeOffPolicyUpdateInput,
	TimeOffPolicy as ITimeOffPolicy,
	PermissionsEnum
} from '@gauzy/models';
import { IPagination } from '../core';
import { TimeOffPolicyService } from './time-off-policy.service';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Policy')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class TimeOffPolicyControler extends CrudController<TimeOffPolicy> {
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
		@Query('data') data: string
	): Promise<IPagination<ITimeOffPolicy>> {
		const { relations, findInput } = JSON.parse(data);

		return this.policyService.getAllPolicies({
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
		@Param('id') id: string,
		@Body() entity: ITimeOffPolicyUpdateInput,
		...options: any[]
	): Promise<ITimeOffPolicy> {
		return this.policyService.update(id, entity);
	}
}

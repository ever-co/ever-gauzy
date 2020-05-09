import { CrudController, IPagination } from '../core';
import { ApprovalsPolicy } from './approvals-policy.entity';
import { ApprovalsPolicyService } from './approvals-policy.service';
import {
	ApprovalsPolicy as IApprovalsPolicy,
	PermissionsEnum,
	ApprovalsPolicyCreateInput as IApprovalsPolicyCreateInput,
	ApprovalsPolicyUpdateInput as IApprovalsPolicyUpdateInput
} from '@gauzy/models';
import {
	Query,
	HttpStatus,
	UseGuards,
	Get,
	Post,
	Body,
	HttpCode,
	Put,
	Param,
	Controller
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { Permissions } from '../shared/decorators/permissions';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('approvals-policy')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ApprovalsPolicyControler extends CrudController<ApprovalsPolicy> {
	constructor(
		private readonly approvalsPolicyService: ApprovalsPolicyService
	) {
		super(approvalsPolicyService);
	}

	@ApiOperation({ summary: 'Find all policies.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: ApprovalsPolicy
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.APPROVALS_POLICY_VIEW)
	@Get()
	findAllApprovalsPolicies(@Query('data') data: string): any {
		console.log('data1111', data);
		const { findInput, relations } = JSON.parse(data);

		return this.approvalsPolicyService.getAllPolicies({
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
	@Permissions(PermissionsEnum.APPROVALS_POLICY_EDIT)
	@Post('')
	async createTimeOffPolicy(
		@Body() entity: IApprovalsPolicyCreateInput
	): Promise<ApprovalsPolicy> {
		console.log('entity', entity);
		return this.approvalsPolicyService.create(entity);
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
	@Permissions(PermissionsEnum.APPROVALS_POLICY_EDIT)
	@Put(':id')
	async updateOrganizationTeam(
		@Param('id') id: string,
		@Body() entity: IApprovalsPolicyUpdateInput
	): Promise<ApprovalsPolicy> {
		return this.approvalsPolicyService.update(id, entity);
	}
}

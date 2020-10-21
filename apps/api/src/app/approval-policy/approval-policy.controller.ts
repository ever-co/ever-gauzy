import { CrudController } from '../core';
import { ApprovalPolicy } from './approval-policy.entity';
import { ApprovalPolicyService } from './approval-policy.service';
import {
	PermissionsEnum,
	IApprovalPolicyCreateInput,
	IApprovalPolicyUpdateInput
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
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';
import { ParseJsonPipe } from '../shared/pipes/parse-json.pipe';

@ApiTags('ApprovalPolicy')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ApprovalPolicyController extends CrudController<ApprovalPolicy> {
	constructor(private readonly approvalPolicyService: ApprovalPolicyService) {
		super(approvalPolicyService);
	}

	@ApiOperation({ summary: 'Find all approval policies.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: ApprovalPolicy
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.APPROVAL_POLICY_VIEW)
	@Get()
	findAllApprovalPolicies(@Query('data', ParseJsonPipe) data: any): any {
		const { findInput, relations } = data;
		return this.approvalPolicyService.findAllApprovalPolicies({
			where: findInput,
			relations
		});
	}

	@ApiOperation({
		summary:
			'Find all approval policies except time off and equipment sharing policy.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: ApprovalPolicy
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.APPROVAL_POLICY_VIEW)
	@Get('/requestapproval')
	findApprovalPoliciesForRequestApproval(
		@Query('data', ParseJsonPipe) data: any
	): any {
		const { findInput, relations } = data;
		return this.approvalPolicyService.findApprovalPoliciesForRequestApproval(
			findInput,
			relations
		);
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
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.APPROVAL_POLICY_EDIT)
	@Post('')
	async createApprovalPolicy(
		@Body() entity: IApprovalPolicyCreateInput
	): Promise<ApprovalPolicy> {
		return this.approvalPolicyService.create(entity);
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
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.APPROVAL_POLICY_EDIT)
	@Put(':id')
	async updateApprovalPolicy(
		@Param('id') id: string,
		@Body() entity: IApprovalPolicyUpdateInput
	): Promise<ApprovalPolicy> {
		return this.approvalPolicyService.update(id, entity);
	}
}

import { CrudController } from '../core';
import { ApprovalPolicy } from './approval-policy.entity';
import { ApprovalPolicyService } from './approval-policy.service';
import {
	PermissionsEnum,
	IApprovalPolicyCreateInput,
	IApprovalPolicyUpdateInput,
	IPagination,
	IApprovalPolicy,
	IListQueryInput,
	IRequestApprovalFindInput
} from '@gauzy/contracts';
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
import { CommandBus } from '@nestjs/cqrs';
import {
	ApprovalPolicyCreateCommand,
	ApprovalPolicyGetCommand,
	ApprovalPolicyUpdateCommand,
	RequestApprovalPolicyGetCommand
} from './commands';
import { UUIDValidationPipe } from '../shared';
@ApiTags('ApprovalPolicy')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard, PermissionGuard)
@Controller()
export class ApprovalPolicyController extends CrudController<ApprovalPolicy> {
	constructor(
		private readonly approvalPolicyService: ApprovalPolicyService,
		private readonly commandBus: CommandBus
	) {
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
	@Permissions(PermissionsEnum.APPROVAL_POLICY_VIEW)
	@HttpCode(HttpStatus.ACCEPTED)
	@Get()
	findAllApprovalPolicies(
		@Query('data', ParseJsonPipe)
		data: IListQueryInput<IRequestApprovalFindInput>
	): Promise<IPagination<IApprovalPolicy>> {
		return this.commandBus.execute(new ApprovalPolicyGetCommand(data));
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
	@Permissions(PermissionsEnum.APPROVAL_POLICY_VIEW)
	@HttpCode(HttpStatus.ACCEPTED)
	@Get('/request-approval')
	findApprovalPoliciesForRequestApproval(
		@Query('data', ParseJsonPipe)
		data: IListQueryInput<IRequestApprovalFindInput>
	): Promise<IPagination<IApprovalPolicy>> {
		return this.commandBus.execute(
			new RequestApprovalPolicyGetCommand(data)
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
	@Permissions(PermissionsEnum.APPROVAL_POLICY_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Post()
	async createApprovalPolicy(
		@Body() entity: IApprovalPolicyCreateInput
	): Promise<ApprovalPolicy> {
		return this.commandBus.execute(new ApprovalPolicyCreateCommand(entity));
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
	@Permissions(PermissionsEnum.APPROVAL_POLICY_EDIT)
	@Put(':id')
	async updateApprovalPolicy(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: IApprovalPolicyUpdateInput
	): Promise<ApprovalPolicy> {
		return this.commandBus.execute(
			new ApprovalPolicyUpdateCommand({ id, ...entity })
		);
	}
}

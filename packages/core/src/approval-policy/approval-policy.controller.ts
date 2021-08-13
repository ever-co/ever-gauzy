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
import { CommandBus } from '@nestjs/cqrs';
import { Permissions } from './../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { CrudController } from '../core';
import { ApprovalPolicy } from './approval-policy.entity';
import { ApprovalPolicyService } from './approval-policy.service';
import {
	ApprovalPolicyCreateCommand,
	ApprovalPolicyGetCommand,
	ApprovalPolicyUpdateCommand,
	RequestApprovalPolicyGetCommand
} from './commands';

@ApiTags('ApprovalPolicy')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller()
export class ApprovalPolicyController extends CrudController<ApprovalPolicy> {
	constructor(
		private readonly approvalPolicyService: ApprovalPolicyService,
		private readonly commandBus: CommandBus
	) {
		super(approvalPolicyService);
	}

	/**
	 * GET all approval policies except time off and equipment sharing policy
	 * 
	 * @param data 
	 * @returns 
	 */
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
	@Get('request-approval')
	async findApprovalPoliciesForRequestApproval(
		@Query('data', ParseJsonPipe)
		data: IListQueryInput<IRequestApprovalFindInput>
	): Promise<IPagination<IApprovalPolicy>> {
		return await this.commandBus.execute(
			new RequestApprovalPolicyGetCommand(data)
		);
	}

	/**
	 * GET all approval policies
	 * 
	 * @param data 
	 * @returns 
	 */
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
	async findAll(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IApprovalPolicy>> {
		return await this.commandBus.execute(
			new ApprovalPolicyGetCommand(data)
		);
	}

	/**
	 * CREATE approval policy
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.APPROVAL_POLICY_EDIT)
	@HttpCode(HttpStatus.ACCEPTED)
	@Post()
	async create(
		@Body() entity: IApprovalPolicyCreateInput
	): Promise<IApprovalPolicy> {
		return await this.commandBus.execute(
			new ApprovalPolicyCreateCommand(entity)
		);
	}

	/**
	 * UPDATE approval policy by id
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
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: IApprovalPolicyUpdateInput
	): Promise<IApprovalPolicy> {
		return await this.commandBus.execute(
			new ApprovalPolicyUpdateCommand({ id, ...entity })
		);
	}
}

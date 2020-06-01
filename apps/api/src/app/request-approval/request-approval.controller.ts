import { CrudController, IPagination } from '../core';
import { RequestApproval } from './request-approval.entity';
import { RequestApprovalService } from './request-approval.service';
import {
	RequestApproval as IRequestApproval,
	PermissionsEnum,
	RequestApprovalCreateInput as IRequestApprovalCreateInput,
	RequestApprovalStatusTypesEnum
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

@ApiTags('request-approval')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class RequestApprovalControler extends CrudController<RequestApproval> {
	constructor(
		private readonly requestApprovalService: RequestApprovalService
	) {
		super(requestApprovalService);
	}

	@ApiOperation({ summary: 'Find all request approvals.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: RequestApproval
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_VIEW)
	@Get()
	findAllRequestApprovals(
		@Query('data') data: string
	): Promise<IPagination<IRequestApproval>> {
		const { relations, findInput } = JSON.parse(data);

		return this.requestApprovalService.findAllRequestApprovals({
			where: findInput,
			relations
		});
	}

	@ApiOperation({ summary: 'Find all request approval.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: RequestApproval
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_VIEW)
	@Get('employee/:id')
	findRequestApprovalsByEmployeeId(
		@Param('id') id: string,
		@Query('data') data: string
	): Promise<IPagination<IRequestApproval>> {
		const { relations } = JSON.parse(data);

		return this.requestApprovalService.findRequestApprovalsByEmployeeId({
			where: {
				id
			},
			relations
		});
	}

	@ApiOperation({ summary: 'create a request approval.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: RequestApproval
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	@Post()
	async createRequestApproval(
		@Body() entity: IRequestApprovalCreateInput
	): Promise<RequestApproval> {
		return this.requestApprovalService.createRequestApproval(entity);
	}

	@ApiOperation({ summary: 'employee accept request approval.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: RequestApproval
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	@Put('approval/:id')
	async employeeApprovalRequestApproval(
		@Param('id') id: string
	): Promise<RequestApproval> {
		return this.requestApprovalService.updateStatusRequestApproval(
			id,
			RequestApprovalStatusTypesEnum.APPROVED
		);
	}

	@ApiOperation({ summary: 'employee refuse request approval.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: RequestApproval
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	@Put('refuse/:id')
	async employeeRefuseRequestApproval(
		@Param('id') id: string
	): Promise<RequestApproval> {
		return this.requestApprovalService.updateStatusRequestApproval(
			id,
			RequestApprovalStatusTypesEnum.REFUSED
		);
	}

	@ApiOperation({ summary: 'update a request approval.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found policies',
		type: RequestApproval
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	@Put(':id')
	async updateRequestApproval(
		@Param('id') id: string,
		@Body() entity: IRequestApprovalCreateInput
	): Promise<RequestApproval> {
		return this.requestApprovalService.updateRequestApproval(id, entity);
	}
}

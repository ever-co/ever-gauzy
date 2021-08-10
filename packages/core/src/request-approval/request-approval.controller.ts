import { CrudController } from './../core/crud';
import { RequestApproval } from './request-approval.entity';
import { RequestApprovalService } from './request-approval.service';
import {
	IRequestApproval,
	PermissionsEnum,
	IRequestApprovalCreateInput,
	RequestApprovalStatusTypesEnum,
	IPagination
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
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { RequestApprovalStatusCommand } from './commands';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';

@ApiTags('RequestApproval')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller()
export class RequestApprovalControler extends CrudController<RequestApproval> {
	constructor(
		private readonly requestApprovalService: RequestApprovalService,
		private commandBus: CommandBus
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
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_VIEW)
	@Get()
	findAllRequestApprovals(
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IRequestApproval>> {
		const { relations, findInput } = data;
		return this.requestApprovalService.findAllRequestApprovals(
			{ relations },
			findInput
		);
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
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_VIEW)
	@Get('employee/:id')
	findRequestApprovalsByEmployeeId(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IPagination<IRequestApproval>> {
		const { relations, findInput } = data;
		return this.requestApprovalService.findRequestApprovalsByEmployeeId(
			id,
			relations,
			findInput
		);
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
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	@Put('approval/:id')
	async employeeApprovalRequestApproval(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<RequestApproval> {
		return this.commandBus.execute(
			new RequestApprovalStatusCommand(
				id,
				RequestApprovalStatusTypesEnum.APPROVED
			)
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
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	@Put('refuse/:id')
	async employeeRefuseRequestApproval(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<RequestApproval> {
		return this.commandBus.execute(
			new RequestApprovalStatusCommand(
				id,
				RequestApprovalStatusTypesEnum.REFUSED
			)
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
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	@Put(':id')
	async updateRequestApprovalByAdmin(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: IRequestApprovalCreateInput
	): Promise<RequestApproval> {
		return this.requestApprovalService.updateRequestApproval(id, entity);
	}
}

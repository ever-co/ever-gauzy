import { CrudController, IPagination } from '../core';
import { RequestApproval } from './request-approval.entity';
import { RequestApprovalService } from './request-approval.service';
import {
	RequestApproval as IRequestApproval,
	PermissionsEnum
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

	@ApiOperation({ summary: 'Find all policies.' })
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
	@Permissions(PermissionsEnum.POLICY_VIEW)
	@Get()
	findAllApprovalsPolicies(@Query('data') data: string): string {
		const { relations, findInput } = JSON.parse(data);

		return '';
	}
}

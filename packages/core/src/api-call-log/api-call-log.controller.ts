import { Controller, UseGuards } from '@nestjs/common';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ApiCallLogService } from './api-call-log.service';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions()
@Controller('/api-call-log')
export class ApiCallLogController {
	constructor(readonly _apiCallLogService: ApiCallLogService) {}
}

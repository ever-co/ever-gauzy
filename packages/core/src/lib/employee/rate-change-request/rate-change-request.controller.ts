import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IEmployeeRateChangeRequestResult } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { Permissions } from '../../shared/decorators';
import { UseValidationPipe } from '../../shared/pipes';
import { EmployeeRateChangeRequestDTO } from './rate-change-request.dto';
import { EmployeeRateChangeRequestService } from './rate-change-request.service';

@ApiTags('Employee')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/employee')
export class EmployeeRateChangeRequestController {
	constructor(private readonly rateChangeRequestService: EmployeeRateChangeRequestService) {}

	/** Any employee asks the organization's admins to change their rate; the admins are notified. */
	@ApiOperation({ summary: 'Ask the admins to change your rate' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'The admins were notified' })
	@HttpCode(HttpStatus.ACCEPTED)
	@Throttle({ default: { limit: 5, ttl: 60000 } })
	@Permissions()
	@UseValidationPipe({ whitelist: true, transform: true })
	@Post('/rate-change-request')
	async request(@Body() input: EmployeeRateChangeRequestDTO): Promise<IEmployeeRateChangeRequestResult> {
		return await this.rateChangeRequestService.request(input);
	}
}

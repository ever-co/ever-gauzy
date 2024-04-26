import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenantPermissionGuard } from 'shared';

// @UseGuards(TenantPermissionGuard)
@ApiTags('Plan Daily Tasks')
@Controller()
export class DailyPlanTaskController {
	@Get()
	tryWorks() {
		return { message: 'Module online' };
	}
}

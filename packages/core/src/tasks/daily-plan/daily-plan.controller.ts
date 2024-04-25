import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

// @UseGuards(TenantPermissionGuard)
@ApiTags('Daily Plan')
@Controller()
export class DailyPlanController {
	@Get()
	tryWorks() {
		return { message: 'Daily plan module online' };
	}
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IProfileActivity } from '@gauzy/contracts';
import { TenantPermissionGuard } from '../../shared/guards';
import { UseValidationPipe } from '../../shared/pipes';
import { ProfileActivityQueryDTO } from './dto/profile-activity-query.dto';
import { StatisticService } from './statistic.service';

@ApiTags('TimesheetStatistic')
@UseGuards(TenantPermissionGuard)
@Controller('/timesheet/statistics')
export class ProfileActivityController {
	constructor(private readonly statisticService: StatisticService) {}

	@Get('/profile-activity')
	@UseValidationPipe({ transform: true, whitelist: true })
	getProfileActivity(@Query() query: ProfileActivityQueryDTO): Promise<IProfileActivity> {
		return this.statisticService.getProfileActivity(query);
	}
}

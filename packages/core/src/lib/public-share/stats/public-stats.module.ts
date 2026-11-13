import { forwardRef, Module } from '@nestjs/common';
import { EmployeeModule } from '../../employee/employee.module';
import { OrganizationProjectModule } from '../../organization-project/organization-project.module';
import { OrganizationTeamModule } from '../../organization-team/organization-team.module';
import { TenantModule } from '../../tenant/tenant.module';
import { ScreenshotModule } from '../../time-tracking/screenshot/screenshot.module';
import { TimeSlotModule } from '../../time-tracking/time-slot/time-slot.module';
import { UserModule } from '../../user/user.module';
import { PublicStatsController } from './public-stats.controller';
import { PublicStatsService } from './public-stats.service';

/**
 * `GET /public/stats`. Reads across the platform like `StatsModule` does, and names its modules through
 * forward references for the same reason (see the note there): a plain import of a module still being
 * evaluated captures `undefined`, and the boot fails naming a position in this array.
 */
@Module({
	imports: [
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		forwardRef(() => EmployeeModule),
		forwardRef(() => OrganizationTeamModule),
		forwardRef(() => OrganizationProjectModule),
		forwardRef(() => ScreenshotModule),
		forwardRef(() => TimeSlotModule)
	],
	controllers: [PublicStatsController],
	providers: [PublicStatsService]
})
export class PublicStatsModule {}

import { Module } from '@nestjs/common';
import { FeatureModule } from '../feature/feature.module';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from '../user/user.module';
import { EmployeeModule } from '../employee/employee.module';
import { OrganizationModule } from '../organization/organization.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
	imports: [FeatureModule, TenantModule, UserModule, EmployeeModule, OrganizationModule],
	controllers: [StatsController],
	providers: [StatsService]
})
export class StatsModule {}

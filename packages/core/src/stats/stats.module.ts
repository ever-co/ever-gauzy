import { Module } from '@nestjs/common';
import { FeatureModule } from '../feature/feature.module';
import { EmployeeModule } from '../employee/employee.module';
import { OrganizationModule } from '../organization/organization.module';
import { OrganizationTeamModule } from '../organization-team/organization-team.module';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from '../user/user.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { PaymentModule } from '../payment/payment.module';
import { TaskModule } from '../tasks/task.module';
import { StatisticModule } from '../time-tracking/statistic';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
	imports: [
		FeatureModule,
		EmployeeModule,
		OrganizationModule,
		OrganizationTeamModule,
		TenantModule,
		UserModule,
		InvoiceModule,
		PaymentModule,
		TaskModule,
		StatisticModule
	],
	controllers: [StatsController],
	providers: [StatsService]
})
export class StatsModule {}

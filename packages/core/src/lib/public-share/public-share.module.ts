import { Module } from '@nestjs/common';
import { PublicEmployeeModule } from './employee/public-employee.module';
import { PublicInvoiceModule } from './invoice/public-invoice.module';
import { PublicOrganizationModule } from './organization/public-organization.module';
import { PublicStatsModule } from './stats/public-stats.module';
import { PublicTeamModule } from './team/public-team.module';

@Module({
	imports: [PublicEmployeeModule, PublicInvoiceModule, PublicOrganizationModule, PublicStatsModule, PublicTeamModule]
})
export class PublicShareModule {}

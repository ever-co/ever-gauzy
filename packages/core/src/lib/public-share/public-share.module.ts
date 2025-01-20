import { Module } from '@nestjs/common';
import { PublicEmployeeModule } from './employee/public-employee.module';
import { PublicInvoiceModule } from './invoice/public-invoice.module';
import { PublicOrganizationModule } from './organization/public-organization.module';
import { PublicTeamModule } from './team/public-team.module';

@Module({
	imports: [PublicEmployeeModule, PublicInvoiceModule, PublicOrganizationModule, PublicTeamModule]
})
export class PublicShareModule {}

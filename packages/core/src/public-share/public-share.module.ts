import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { PublicEmployeeModule } from './employee/public-employee.module';
import { PublicInvoiceModule } from './invoice/public-invoice.module';
import { PublicOrganizationModule } from './organization/public-organization.module';
import { PublicTeamModule } from './team/public-team.module';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/public',
				module: PublicShareModule,
				children: [
					{ path: '/employee', module: PublicEmployeeModule },
					{ path: '/invoice', module: PublicInvoiceModule },
					{ path: '/organization', module: PublicOrganizationModule },
					{ path: '/team', module: PublicTeamModule }
				]
			}
		]),
		PublicEmployeeModule,
		PublicInvoiceModule,
		PublicOrganizationModule,
		PublicTeamModule
	],
	controllers: [],
	providers: [],
	exports: []
})
export class PublicShareModule {}

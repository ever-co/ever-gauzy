import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { PublicEmployeeModule } from './employee/public-employee.module';
import { PublicInvoiceModule } from './invoice/public-invoice.module';
import { PublicOrganizationModule } from './organization/public-organization.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/public', module: PublicShareModule,
				children: [
					{ path: '/employee', module: PublicEmployeeModule },
					{ path: '/invoice', module: PublicInvoiceModule },
					{ path: '/organization', module: PublicOrganizationModule },
				]
			}
		]),
		PublicEmployeeModule,
		PublicInvoiceModule,
		PublicOrganizationModule,
	],
	controllers: [],
	providers: [],
	exports: []
})
export class PublicShareModule {}
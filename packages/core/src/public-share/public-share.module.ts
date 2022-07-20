import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { PublicEmployeeModule } from './employee/public-employee.module';
import { PublicOrganizationModule } from './organization/public-organization.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/public', module: PublicShareModule,
				children: [
					{ path: '/employee', module: PublicEmployeeModule },
					{ path: '/organization', module: PublicOrganizationModule }
				]
			}
		]),
		PublicEmployeeModule,
		PublicOrganizationModule
	],
	controllers: [],
	providers: [],
	exports: []
})
export class PublicShareModule {}
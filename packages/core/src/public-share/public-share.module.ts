import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { PublicOrganizationModule } from './organization/public-organization.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/public', module: PublicShareModule,
				children: [
					{ path: '/organization', module: PublicOrganizationModule }
				]
			}
		]),
		PublicOrganizationModule
	],
	controllers: [],
	providers: [],
	exports: []
})
export class PublicShareModule {}
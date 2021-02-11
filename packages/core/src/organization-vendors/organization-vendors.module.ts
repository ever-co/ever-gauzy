import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { OrganizationVendor } from './organization-vendors.entity';
import { OrganizationVendorsController } from './organization-vendors.controller';
import { OrganizationVendorsService } from './organization-vendors.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/organization-vendors', module: OrganizationVendorsModule }
		]),
		TypeOrmModule.forFeature([OrganizationVendor]),
		TenantModule
	],
	controllers: [OrganizationVendorsController],
	providers: [OrganizationVendorsService],
	exports: [OrganizationVendorsService]
})
export class OrganizationVendorsModule {}

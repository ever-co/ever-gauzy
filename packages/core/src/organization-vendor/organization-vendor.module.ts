import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { OrganizationVendor } from './organization-vendor.entity';
import { OrganizationVendorController } from './organization-vendor.controller';
import { OrganizationVendorService } from './organization-vendor.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/organization-vendors', module: OrganizationVendorModule }
		]),
		TypeOrmModule.forFeature([OrganizationVendor]),
		TenantModule
	],
	controllers: [OrganizationVendorController],
	providers: [OrganizationVendorService],
	exports: [OrganizationVendorService]
})
export class OrganizationVendorModule {}

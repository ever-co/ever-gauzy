import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { OrganizationVendor } from './organization-vendor.entity';
import { OrganizationVendorController } from './organization-vendor.controller';
import { OrganizationVendorService } from './organization-vendor.service';
import { TenantModule } from '../tenant/tenant.module';
import { CommandHandlers } from './commands/handlers';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/organization-vendors', module: OrganizationVendorModule }]),
		TypeOrmModule.forFeature([OrganizationVendor]),
		MikroOrmModule.forFeature([OrganizationVendor]),
		TenantModule
	],
	controllers: [OrganizationVendorController],
	providers: [OrganizationVendorService, ...CommandHandlers],
	exports: [TypeOrmModule, OrganizationVendorService]
})
export class OrganizationVendorModule { }

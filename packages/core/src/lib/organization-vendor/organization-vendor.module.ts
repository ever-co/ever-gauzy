import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationVendor } from './organization-vendor.entity';
import { OrganizationVendorController } from './organization-vendor.controller';
import { OrganizationVendorService } from './organization-vendor.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: '/organization-vendors', module: OrganizationVendorModule }]),
		TypeOrmModule.forFeature([OrganizationVendor]),
		MikroOrmModule.forFeature([OrganizationVendor]),
		RolePermissionModule
	],
	controllers: [OrganizationVendorController],
	providers: [OrganizationVendorService, ...CommandHandlers],
	exports: [OrganizationVendorService]
})
export class OrganizationVendorModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationVendor } from './organization-vendor.entity';
import { OrganizationVendorController } from './organization-vendor.controller';
import { OrganizationVendorService } from './organization-vendor.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmOrganizationVendorRepository } from './repository/type-orm-organization-vendor.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationVendor]),
		MikroOrmModule.forFeature([OrganizationVendor]),
		RolePermissionModule
	],
	controllers: [OrganizationVendorController],
	providers: [OrganizationVendorService, TypeOrmOrganizationVendorRepository, ...CommandHandlers]
})
export class OrganizationVendorModule {}

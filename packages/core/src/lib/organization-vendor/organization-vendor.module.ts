import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationVendor } from './organization-vendor.entity';
import { OrganizationVendorController } from './organization-vendor.controller';
import { OrganizationVendorResolver } from './organization-vendor.resolver';
import { OrganizationVendorService } from './organization-vendor.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmOrganizationVendorRepository } from './repository/type-orm-organization-vendor.repository';
import { MikroOrmOrganizationVendorRepository } from './repository/mikro-orm-organization-vendor.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationVendor]),
		MikroOrmModule.forFeature([OrganizationVendor]),
		RolePermissionModule
	],
	controllers: [OrganizationVendorController],
	providers: [
		OrganizationVendorService,
		// The GraphQL surface is declared beside the service it calls, so the host that scans this module
		// for resolvers reaches everything the resolver injects.
		OrganizationVendorResolver,
		TypeOrmOrganizationVendorRepository,
		MikroOrmOrganizationVendorRepository,
		...CommandHandlers
	],
	exports: [OrganizationVendorService]
})
export class OrganizationVendorModule {}
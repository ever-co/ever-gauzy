import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { OrganizationEmploymentTypeController } from './organization-employment-type.controller';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { OrganizationEmploymentTypeResolver } from './organization-employment-type.resolver';
import { OrganizationEmploymentTypeService } from './organization-employment-type.service';
import { TypeOrmOrganizationEmploymentTypeRepository } from './repository/type-orm-organization-employment-type.repository';
import { MikroOrmOrganizationEmploymentTypeRepository } from './repository/mikro-orm-organization-employment-type.repository';

/**
 * The vocabulary an organization classifies its people by.
 *
 * The resolver is declared here, beside the service it calls, because a resolver is an ordinary Nest
 * provider and can only inject what the module hosting it can reach. The service is exported so the
 * module that hosts the resolver graph receives it through this module's own export rather than
 * reaching into the container.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationEmploymentType]),
		MikroOrmModule.forFeature([OrganizationEmploymentType]),
		RolePermissionModule
	],
	controllers: [OrganizationEmploymentTypeController],
	providers: [
		OrganizationEmploymentTypeService,
		// The GraphQL view of the same resource.
		OrganizationEmploymentTypeResolver,
		TypeOrmOrganizationEmploymentTypeRepository,
		MikroOrmOrganizationEmploymentTypeRepository
	],
	exports: [
		OrganizationEmploymentTypeService,
		TypeOrmOrganizationEmploymentTypeRepository,
		MikroOrmOrganizationEmploymentTypeRepository
	]
})
export class OrganizationEmploymentTypeModule {}

import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationProjectModuleService } from './organization-project-module.service';
import { OrganizationProjectModuleController } from './organization-project-module.controller';
import { OrganizationProjectModule } from './organization-project-module.entity';
import { TypeOrmOrganizationProjectModuleRepository } from './repository/type-orm-organization-project-module.repository';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/organization-project-modules',
				module: OrganizationProjectModuleModule
			}
		]),
		TypeOrmModule.forFeature([OrganizationProjectModule]),
		MikroOrmModule.forFeature([OrganizationProjectModule]),
		MikroOrmModule,
		RolePermissionModule
	],
	controllers: [OrganizationProjectModuleController],
	providers: [OrganizationProjectModuleService, TypeOrmOrganizationProjectModuleRepository],
	exports: [TypeOrmModule, OrganizationProjectModuleService, TypeOrmOrganizationProjectModuleRepository]
})
export class OrganizationProjectModuleModule {}

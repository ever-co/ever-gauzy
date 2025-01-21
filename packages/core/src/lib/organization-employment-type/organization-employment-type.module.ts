import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { OrganizationEmploymentTypeController } from './organization-employment-type.controller';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { OrganizationEmploymentTypeService } from './organization-employment-type.service';
import { TypeOrmOrganizationEmploymentTypeRepository } from './repository/type-orm-organization-employment-type.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationEmploymentType]),
		MikroOrmModule.forFeature([OrganizationEmploymentType]),
		RolePermissionModule
	],
	controllers: [OrganizationEmploymentTypeController],
	providers: [OrganizationEmploymentTypeService, TypeOrmOrganizationEmploymentTypeRepository]
})
export class OrganizationEmploymentTypeModule {}

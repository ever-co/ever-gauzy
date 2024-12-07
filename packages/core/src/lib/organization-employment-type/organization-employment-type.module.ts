import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { OrganizationEmploymentTypeController } from './organization-employment-type.controller';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { OrganizationEmploymentTypeService } from './organization-employment-type.service';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/organization-employment-type',
				module: OrganizationEmploymentTypeModule
			}
		]),
		TypeOrmModule.forFeature([OrganizationEmploymentType]),
		MikroOrmModule.forFeature([OrganizationEmploymentType]),
		RolePermissionModule
	],
	controllers: [OrganizationEmploymentTypeController],
	providers: [OrganizationEmploymentTypeService],
	exports: [OrganizationEmploymentTypeService]
})
export class OrganizationEmploymentTypeModule { }

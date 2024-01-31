import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { TenantModule } from '../tenant/tenant.module';
import { OrganizationEmploymentTypeController } from './organization-employment-type.controller';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { OrganizationEmploymentTypeService } from './organization-employment-type.service';
import { MikroOrmModule } from '@mikro-orm/nestjs';

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
		TenantModule
	],
	controllers: [OrganizationEmploymentTypeController],
	providers: [OrganizationEmploymentTypeService],
	exports: [OrganizationEmploymentTypeService]
})
export class OrganizationEmploymentTypeModule { }

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { OrganizationPosition } from './organization-position.entity';
import { OrganizationPositionController } from './organization-position.controller';
import { OrganizationPositionService } from './organization-position.service';
import { TenantModule } from '../tenant/tenant.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([
			{
				path: '/organization-positions',
				module: OrganizationPositionModule
			}
		]),
		TypeOrmModule.forFeature([OrganizationPosition]),
		MikroOrmModule.forFeature([OrganizationPosition]),
		TenantModule
	],
	controllers: [OrganizationPositionController],
	providers: [OrganizationPositionService],
	exports: [OrganizationPositionService]
})
export class OrganizationPositionModule { }

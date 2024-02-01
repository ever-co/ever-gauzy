import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { OrganizationAward } from './organization-award.entity';
import { OrganizationAwardController } from './organization-award.controller';
import { OrganizationAwardService } from './organization-award.service';
import { TenantModule } from '../tenant/tenant.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/organization-awards', module: OrganizationAwardModule }]),
		TypeOrmModule.forFeature([OrganizationAward]),
		MikroOrmModule.forFeature([OrganizationAward]),
		TenantModule
	],
	controllers: [OrganizationAwardController],
	providers: [OrganizationAwardService],
	exports: [OrganizationAwardService]
})
export class OrganizationAwardModule { }

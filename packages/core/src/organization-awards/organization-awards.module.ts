import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { OrganizationAwards } from './organization-awards.entity';
import { OrganizationAwardsController } from './organization-awards.controller';
import { OrganizationAwardsService } from './organization-awards.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/organization-awards', module: OrganizationAwardsModule }
		]),
		TypeOrmModule.forFeature([OrganizationAwards]),
		TenantModule
	],
	controllers: [OrganizationAwardsController],
	providers: [OrganizationAwardsService],
	exports: [OrganizationAwardsService]
})
export class OrganizationAwardsModule {}

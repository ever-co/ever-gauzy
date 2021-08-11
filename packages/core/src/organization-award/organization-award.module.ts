import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { OrganizationAward } from './organization-award.entity';
import { OrganizationAwardController } from './organization-award.controller';
import { OrganizationAwardService } from './organization-award.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/organization-awards', module: OrganizationAwardModule }
		]),
		TypeOrmModule.forFeature([OrganizationAward]),
		TenantModule
	],
	controllers: [OrganizationAwardController],
	providers: [OrganizationAwardService],
	exports: [OrganizationAwardService]
})
export class OrganizationAwardModule {}

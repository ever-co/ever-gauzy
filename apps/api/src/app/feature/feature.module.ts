import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feature } from './feature.entity';
import { FeatureOrganization } from './feature_organization.entity';
import { FeaturesToggleController } from './feature-toggle.controller';
import { FeatureService } from './feature.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		TypeOrmModule.forFeature([Feature, FeatureOrganization]),
		TenantModule
	],
	controllers: [FeaturesToggleController],
	providers: [FeatureService]
})
export class FeatureModule {}

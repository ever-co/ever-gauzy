import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Feature } from './feature.entity';
import { FeatureOrganization } from './feature_organization.entity';
import { FeaturesToggleController } from './feature-toggle.controller';

@Module({
	imports: [TypeOrmModule.forFeature([Feature, FeatureOrganization])],
	controllers: [FeaturesToggleController],
	providers: []
})
export class FeatureModule {}

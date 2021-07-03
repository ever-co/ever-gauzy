import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { Feature } from './feature.entity';
import { FeatureOrganization } from './feature_organization.entity';
import { FeaturesToggleController } from './feature-toggle.controller';
import { FeatureService } from './feature.service';
import { TenantModule } from '../tenant/tenant.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/feature/toggle', module: FeatureModule }
		]),
		TypeOrmModule.forFeature([Feature, FeatureOrganization]),
		forwardRef(() => TenantModule),
		CqrsModule
	],
	controllers: [FeaturesToggleController],
	providers: [FeatureService, ...CommandHandlers],
	exports: [FeatureService]
})
export class FeatureModule {}

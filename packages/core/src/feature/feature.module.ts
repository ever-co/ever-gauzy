import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { Feature } from './feature.entity';
import { FeatureOrganization } from './feature-organization.entity';
import { FeatureToggleController } from './feature-toggle.controller';
import { FeatureService } from './feature.service';
import { FeatureOrganizationService } from './feature-organization.service';
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
	controllers: [FeatureToggleController],
	providers: [FeatureService, FeatureOrganizationService, ...CommandHandlers],
	exports: [FeatureService, FeatureOrganizationService]
})
export class FeatureModule {}

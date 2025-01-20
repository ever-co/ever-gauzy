import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Feature } from './feature.entity';
import { FeatureOrganization } from './feature-organization.entity';
import { FeatureToggleController } from './feature-toggle.controller';
import { FeatureService } from './feature.service';
import { FeatureOrganizationService } from './feature-organization.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmFeatureOrganizationRepository, TypeOrmFeatureRepository } from './repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Feature, FeatureOrganization]),
		MikroOrmModule.forFeature([Feature, FeatureOrganization]),
		forwardRef(() => RolePermissionModule),
		CqrsModule
	],
	controllers: [FeatureToggleController],
	providers: [
		FeatureService,
		FeatureOrganizationService,
		TypeOrmFeatureRepository,
		TypeOrmFeatureOrganizationRepository,
		...CommandHandlers
	],
	exports: [FeatureService, FeatureOrganizationService]
})
export class FeatureModule {}

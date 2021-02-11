import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { AuthModule } from '../auth/auth.module';
import { Feature } from '../feature/feature.entity';
import { FeatureService } from '../feature/feature.service';
import { FeatureOrganization } from '../feature/feature_organization.entity';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { CommandHandlers } from './commands/handlers';
import { TenantController } from './tenant.controller';
import { Tenant } from './tenant.entity';
import { TenantService } from './tenant.service';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/tenant', module: TenantModule }]),
		TypeOrmModule.forFeature([Tenant, Feature, FeatureOrganization]),
		AuthModule,
		UserModule,
		RoleModule,
		RolePermissionsModule,
		CqrsModule
	],
	controllers: [TenantController],
	providers: [TenantService, FeatureService, ...CommandHandlers],
	exports: [TenantService, RolePermissionsModule]
})
export class TenantModule {}

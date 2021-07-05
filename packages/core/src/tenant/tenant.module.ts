import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { AuthModule } from '../auth/auth.module';
import { RolePermissionsModule } from '../role-permissions/role-permissions.module';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { CommandHandlers } from './commands/handlers';
import { TenantController } from './tenant.controller';
import { Tenant } from './tenant.entity';
import { TenantService } from './tenant.service';
import { FeatureModule } from './../feature/feature.module';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/tenant', module: TenantModule }]),
		TypeOrmModule.forFeature([ Tenant ]),
		AuthModule,
		UserModule,
		RoleModule,
		RolePermissionsModule,
		forwardRef(() => FeatureModule),
		CqrsModule
	],
	controllers: [TenantController],
	providers: [TenantService, ...CommandHandlers],
	exports: [TenantService, RolePermissionsModule]
})
export class TenantModule {}
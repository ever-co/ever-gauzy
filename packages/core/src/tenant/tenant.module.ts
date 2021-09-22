import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { AuthModule } from '../auth/auth.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { FeatureModule } from './../feature/feature.module';
import { TenantController } from './tenant.controller';
import { Tenant } from './tenant.entity';
import { TenantService } from './tenant.service';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/tenant', module: TenantModule }
		]),
		TypeOrmModule.forFeature([ Tenant ]),
		AuthModule,
		UserModule,
		RoleModule,
		RolePermissionModule,
		forwardRef(() => FeatureModule),
		CqrsModule
	],
	controllers: [TenantController],
	providers: [TenantService, ...CommandHandlers],
	exports: [TenantService, RolePermissionModule]
})
export class TenantModule {}
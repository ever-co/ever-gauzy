import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthModule } from '../auth/auth.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { FeatureModule } from './../feature/feature.module';
import { TenantController } from './tenant.controller';
import { Tenant } from './tenant.entity';
import { TenantService } from './tenant.service';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmTenantRepository } from './repository';

@Module({
	imports: [
		RouterModule.register([
			{ path: '/tenant', module: TenantModule }
		]),
		TypeOrmModule.forFeature([Tenant]),
		MikroOrmModule.forFeature([Tenant]),
		AuthModule,
		CqrsModule,
		forwardRef(() => UserModule),
		forwardRef(() => RoleModule),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => FeatureModule)
	],
	controllers: [TenantController],
	providers: [TenantService, TypeOrmTenantRepository, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, TenantService, TypeOrmTenantRepository]
})
export class TenantModule { }

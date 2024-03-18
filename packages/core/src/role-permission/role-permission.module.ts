import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionController } from './role-permission.controller';
import { RolePermission } from './role-permission.entity';
import { RolePermissionService } from './role-permission.service';
import { RoleModule } from './../role/role.module';
import { TypeOrmRolePermissionRepository } from './repository';

@Module({
	imports: [
		RouterModule.register([
			{ path: 'role-permissions', module: RolePermissionModule }
		]),
		forwardRef(() => TypeOrmModule.forFeature([RolePermission])),
		forwardRef(() => MikroOrmModule.forFeature([RolePermission])),
		forwardRef(() => RoleModule),
		CqrsModule,
		CacheModule.register({ isGlobal: true })
	],
	controllers: [RolePermissionController],
	providers: [RolePermissionService, TypeOrmRolePermissionRepository],
	exports: [TypeOrmModule, MikroOrmModule, CacheModule, RolePermissionService, TypeOrmRolePermissionRepository]
})
export class RolePermissionModule { }

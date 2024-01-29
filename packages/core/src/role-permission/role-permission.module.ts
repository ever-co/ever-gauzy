import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionController } from './role-permission.controller';
import { RolePermission } from './role-permission.entity';
import { RolePermissionService } from './role-permission.service';
import { UserModule } from '../user/user.module';
import { TenantModule } from '../tenant/tenant.module';
import { RoleModule } from './../role/role.module';

const entities = [
	RolePermission
];

@Module({
	imports: [
		RouterModule.register([
			{ path: 'role-permissions', module: RolePermissionModule }
		]),
		forwardRef(() => MikroOrmModule.forFeature([...entities])),
		forwardRef(() => TypeOrmModule.forFeature([...entities])),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		forwardRef(() => RoleModule),
		CqrsModule
	],
	controllers: [RolePermissionController],
	providers: [RolePermissionService],
	exports: [
		MikroOrmModule,
		TypeOrmModule,
		RolePermissionService
	]
})
export class RolePermissionModule { }

import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Role } from './role.entity';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from './../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';
import { CommandHandlers } from './commands/handlers';

const entities = [
	Role
];

@Module({
	imports: [
		RouterModule.register([
			{ path: '/roles', module: RoleModule }
		]),
		forwardRef(() => MikroOrmModule.forFeature([
			...entities
		])),
		forwardRef(() => TypeOrmModule.forFeature([
			...entities
		])),
		forwardRef(() => TenantModule),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => UserModule),
		CqrsModule
	],
	controllers: [RoleController],
	providers: [RoleService, ...CommandHandlers],
	exports: [
		MikroOrmModule,
		TypeOrmModule,
		RoleService
	]
})
export class RoleModule { }

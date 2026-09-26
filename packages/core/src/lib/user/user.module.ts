// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { CqrsModule } from '@nestjs/cqrs';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserResolver } from './user.resolver';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { FactoryResetModule } from './factory-reset/factory-reset.module';
import { TaskModule } from './../tasks/task.module';
import { EmployeeModule } from './../employee/employee.module';
import { PasswordHashModule } from '../password-hash/password-hash.module';
import { TypeOrmUserRepository } from './repository/type-orm-user.repository';
import { MikroOrmUserRepository } from './repository/mikro-orm-user.repository';

/**
 * The account, and the membership rows that put it inside an organization.
 *
 * **The GraphQL view of the same resource is declared here, beside the service it calls**, because a
 * resolver is an ordinary Nest provider and can only inject what the module hosting it can reach.
 * `UserService` is already exported, so the resolver's first dependency needed nothing new; the other
 * two did, and they are re-exported rather than merely imported:
 *
 * - `CqrsModule`, because the resolver dispatches the same create and delete commands the REST routes
 *   dispatch, and a command bus is resolved from the module that hosts the handler — a module's
 *   imports are not inherited by the module that imports it.
 * - `FactoryResetModule`, because the tenant reset is one of the routes this resource serves and its
 *   service is injected by the same resolver. The module already exported the service; what was
 *   missing was a path from the module that hosts the resolver to it.
 *
 * Both additions are exports and nothing else: no provider, route or dependency changed.
 */
@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([User]),
		MikroOrmModule.forFeature([User]),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => TaskModule),
		forwardRef(() => EmployeeModule),
		PasswordHashModule,
		FactoryResetModule
	],
	controllers: [UserController],
	providers: [
		UserService,
		// The GraphQL view of the same resource.
		UserResolver,
		TypeOrmUserRepository,
		MikroOrmUserRepository,
		...CommandHandlers
	],
	exports: [UserService, TypeOrmUserRepository, MikroOrmUserRepository, CqrsModule, FactoryResetModule]
})
export class UserModule {}

// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { CqrsModule } from '@nestjs/cqrs';
import { forwardRef, Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { FactoryResetModule } from './factory-reset/factory-reset.module';
import { TaskModule } from './../tasks/task.module';
import { EmployeeModule } from './../employee/employee.module';
import { TypeOrmUserRepository } from './repository/type-orm-user.repository';
import { OrganizationProjectModuleModule } from 'organization-project-module/organization-project-module.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/user', module: UserModule }]),
		forwardRef(() => TypeOrmModule.forFeature([User])),
		forwardRef(() => MikroOrmModule.forFeature([User])),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => TaskModule),
		forwardRef(() => EmployeeModule),
		forwardRef(() => OrganizationProjectModuleModule),
		CqrsModule,
		FactoryResetModule
	],
	controllers: [UserController],
	providers: [UserService, TypeOrmUserRepository, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, UserService, TypeOrmUserRepository]
})
export class UserModule {}

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
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { FactoryResetModule } from './factory-reset/factory-reset.module';
import { TaskModule } from './../tasks/task.module';
import { EmployeeModule } from './../employee/employee.module';
import { TypeOrmUserRepository } from './repository/type-orm-user.repository';
import { MikroOrmUserRepository } from './repository/mikro-orm-user.repository';

@Module({
	imports: [
		forwardRef(() => TypeOrmModule.forFeature([User])),
		forwardRef(() => MikroOrmModule.forFeature([User])),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => TaskModule),
		forwardRef(() => EmployeeModule),
		CqrsModule,
		FactoryResetModule
	],
	controllers: [UserController],
	providers: [UserService, TypeOrmUserRepository, MikroOrmUserRepository, ...CommandHandlers],
	exports: [UserService, TypeOrmUserRepository, MikroOrmUserRepository]
})
export class UserModule {}

// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { CommandHandlers } from './commands/handlers';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TenantModule } from '../tenant/tenant.module';
import { FactoryResetModule } from './factory-reset/factory-reset.module';
import { TaskModule } from './../tasks/task.module';

@Module({
	imports: [
		RouterModule.register([
			{ path: '/user', module: UserModule }
		]),
		forwardRef(() => TypeOrmModule.forFeature([User])),
		forwardRef(() => MikroOrmModule.forFeature([User])),
		forwardRef(() => TenantModule),
		forwardRef(() => TaskModule),
		CqrsModule,
		FactoryResetModule
	],
	controllers: [UserController],
	providers: [UserService, ...CommandHandlers],
	exports: [
		TypeOrmModule,
		MikroOrmModule,
		UserService
	]
})
export class UserModule { }

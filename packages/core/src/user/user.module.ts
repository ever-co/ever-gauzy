// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { forwardRef, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CommandHandlers } from './commands/handlers';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { SharedModule } from '../shared';
import { TenantModule } from '../tenant/tenant.module';
import { FactoryResetModule } from './factory-reset/factory-reset.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/user', module: UserModule }
		]),
		forwardRef(() => TypeOrmModule.forFeature([ User ])),
		forwardRef(() => TenantModule),
		SharedModule,
		CqrsModule,
		FactoryResetModule,
	],
	controllers: [UserController],
	providers: [UserService, ...CommandHandlers],
	exports: [TypeOrmModule, UserService]
})
export class UserModule {}

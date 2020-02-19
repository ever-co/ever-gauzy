// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { SharedModule } from '../shared';

@Module({
	imports: [TypeOrmModule.forFeature([User]), SharedModule],
	controllers: [UserController],
	providers: [UserService],
	exports: [TypeOrmModule, UserService]
})
export class UserModule {}

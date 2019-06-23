// Modified code from https://github.com/xmlking/ngx-starter-kit. 
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Controller } from '@nestjs/common';
import {  ApiUseTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { CrudController } from '../core/crud/crud.controller';
import { User } from './user.entity';

@ApiUseTags('User')
@Controller()
export class UserController extends CrudController<User> {
  constructor(private readonly userService: UserService) {
    super(userService);
  }
}

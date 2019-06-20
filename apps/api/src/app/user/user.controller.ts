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

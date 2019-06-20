import { Controller } from '@nestjs/common';
import {  ApiUseTags } from '@nestjs/swagger';
import { UserService } from './user.service';

@ApiUseTags('User')
@Controller()
export class UserController  {
  constructor(private readonly userService: UserService) {
  }
}

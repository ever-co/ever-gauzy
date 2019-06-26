// Modified code from https://github.com/xmlking/ngx-starter-kit. 
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CrudService } from '../core/crud/crud.service';

@Injectable()
export class UserService extends CrudService<User> {
  constructor(@InjectRepository(User) private readonly userRepository: Repository<User>) {
    super(userRepository);
  }

  async checkIfExists(id: string): Promise<boolean> {
    const count = await this.repository.createQueryBuilder('user').where("user.id = :id", { id }).getCount();
    return count > 0;
  }
}

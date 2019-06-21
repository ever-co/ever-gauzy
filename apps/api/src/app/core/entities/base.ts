// Code from https://github.com/xmlking/ngx-starter-kit. 
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { PrimaryGeneratedColumn } from 'typeorm';
import { ApiModelPropertyOptional } from '@nestjs/swagger';

export abstract class Base {
  @ApiModelPropertyOptional({ type: String })
  @PrimaryGeneratedColumn('uuid')
  id?: string;
}

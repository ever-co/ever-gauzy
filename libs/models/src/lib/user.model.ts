// Modified code from https://github.com/xmlking/ngx-starter-kit. 
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Role } from './role.model';
import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface User extends IBaseEntityModel {
  firstName?: string;
  lastName?: string;
  email: string;
  username?: string;
  role?: Role;
  roleId?: string;
  hash?: string;
  imageUrl?: string; 
}

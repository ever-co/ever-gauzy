// Modified code from https://github.com/xmlking/ngx-starter-kit. 
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { Role } from './role.model';

export interface User {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role?: Role;
  roleId?: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

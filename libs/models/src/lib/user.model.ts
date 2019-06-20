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

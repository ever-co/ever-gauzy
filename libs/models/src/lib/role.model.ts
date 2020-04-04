import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { RolePermissions } from './role-permission.model';

export interface Role extends IBaseEntityModel {
	name: string;
	rolePermissions: RolePermissions[];
}

export enum RolesEnum {
	SUPER_ADMIN = 'SUPER_ADMIN',
	ADMIN = 'ADMIN',
	DATA_ENTRY = 'DATA_ENTRY',
	EMPLOYEE = 'EMPLOYEE',
	CANDIDATE = 'CANDIDATE',
	MANAGER = 'MANAGER',
	VIEWER = 'VIEWER'
}

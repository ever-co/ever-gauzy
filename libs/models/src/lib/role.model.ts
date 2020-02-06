import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { RolePermissions } from './role-permission.model';

export interface Role extends IBaseEntityModel {
	name: string;
	rolePermissions: RolePermissions[];
}

export enum RolesEnum {
	ADMIN = 'ADMIN',
	DATA_ENTRY = 'DATA_ENTRY',
	EMPLOYEE = 'EMPLOYEE',
	MANAGER = 'MANAGER',
	VIEWER = 'VIEWER'
}

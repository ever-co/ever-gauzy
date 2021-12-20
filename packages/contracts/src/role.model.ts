import { IBasePerTenantEntityModel } from './base-entity.model';
import { IRolePermission } from './role-permission.model';

export interface IRole extends IRoleCreateInput {
	rolePermissions: IRolePermission[];
}

export interface IRoleCreateInput extends IBasePerTenantEntityModel {
	name: string
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

export interface IRoleMigrateInput extends IBasePerTenantEntityModel {
	name: string;
	isImporting: boolean;
	sourceId: string;
}
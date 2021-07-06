import { IBasePerTenantEntityModel } from './base-entity.model';
import { IRolePermission } from './role-permission.model';

export interface IRole extends IBasePerTenantEntityModel {
	name: string;
	rolePermissions: IRolePermission[];
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

	isImporting?: boolean;
	sourceId?: string;
}
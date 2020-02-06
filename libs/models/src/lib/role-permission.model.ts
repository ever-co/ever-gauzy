import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { Role } from './role.model';

export interface RolePermissions extends IBaseEntityModel {
	roleId: string;
	permission: string;
	role: Role;
	enabled: boolean;
}

export interface RolePermissionsCreateInput {
	roleId: string;
	permission: string;
	enabled: boolean;
}

export interface RolePermissionsUpdateInput extends IBaseEntityModel {
	enabled: boolean;
}

export enum PermissionsEnum {
	ADMIN_DASHBOARD_VIEW = 'ADMIN_DASHBOARD_VIEW',
	ORG_INCOMES_VIEW = 'ORG_INCOMES_VIEW',
	ORG_INCOMES_EDIT = 'ORG_INCOMES_EDIT',
	ORG_EXPENSES_VIEW = 'ORG_EXPENSES_VIEW',
	ORG_EXPENSES_EDIT = 'ORG_EXPENSES_EDIT',
	ORG_PROPOSALS_VIEW = 'ORG_PROPOSALS_VIEW',
	ORG_PROPOSALS_EDIT = 'ORG_PROPOSALS_EDIT',
	ORG_TIME_OFF_VIEW = 'ORG_TIME_OFF_VIEW',
	ORG_EMPLOYEES_VIEW = 'ORG_EMPLOYEES_VIEW',
	ORG_EMPLOYEES_EDIT = 'ORG_EMPLOYEES_EDIT',
	ORG_USERS_VIEW = 'ORG_USERS_VIEW',
	ORG_USERS_EDIT = 'ORG_USERS_EDIT',
	ALL_ORG_VIEW = 'ALL_ORG_VIEW',
	ALL_ORG_EDIT = 'ALL_ORG_EDIT'
}

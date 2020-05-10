// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { PermissionsEnum, Role, RolesEnum } from '@gauzy/models';
import { Connection } from 'typeorm';
import { RolePermissions } from './role-permissions.entity';
import { Tenant } from '../tenant/tenant.entity';

export const defaultRolePermissions = [
	{
		role: RolesEnum.SUPER_ADMIN,
		defaultEnabledPermissions: [
			PermissionsEnum.ADMIN_DASHBOARD_VIEW,
			PermissionsEnum.ORG_INCOMES_VIEW,
			PermissionsEnum.ORG_INCOMES_EDIT,
			PermissionsEnum.ORG_EXPENSES_VIEW,
			PermissionsEnum.ORG_EXPENSES_EDIT,
			PermissionsEnum.ORG_PROPOSALS_VIEW,
			PermissionsEnum.ORG_PROPOSALS_EDIT,
			PermissionsEnum.ORG_TIME_OFF_VIEW,
			PermissionsEnum.ORG_EMPLOYEES_VIEW,
			PermissionsEnum.ORG_EMPLOYEES_EDIT,
			PermissionsEnum.ORG_CANDIDATES_VIEW,
			PermissionsEnum.ORG_CANDIDATES_EDIT,
			PermissionsEnum.ORG_CANDIDATES_TASK_EDIT,
			PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT,
			PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT,
			PermissionsEnum.ORG_CANDIDATES_DOCUMENTS_VIEW,
			PermissionsEnum.ORG_USERS_VIEW,
			PermissionsEnum.ORG_USERS_EDIT,
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.POLICY_EDIT,
			PermissionsEnum.POLICY_VIEW,
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
			PermissionsEnum.CHANGE_SELECTED_CANDIDATE,
			PermissionsEnum.CHANGE_SELECTED_ORGANIZATION,
			PermissionsEnum.CHANGE_ROLES_PERMISSIONS,
			PermissionsEnum.ORG_INVITE_VIEW,
			PermissionsEnum.ORG_INVITE_EDIT,
			PermissionsEnum.ACCESS_PRIVATE_PROJECTS,
			PermissionsEnum.TIMESHEET_EDIT_TIME,
			PermissionsEnum.SUPER_ADMIN_EDIT,
			PermissionsEnum.PUBLIC_PAGE_EDIT,
			PermissionsEnum.INVOICES_VIEW,
			PermissionsEnum.INVOICES_EDIT
		]
	},
	{
		role: RolesEnum.ADMIN,
		defaultEnabledPermissions: [
			PermissionsEnum.ADMIN_DASHBOARD_VIEW,
			PermissionsEnum.ORG_INCOMES_VIEW,
			PermissionsEnum.ORG_INCOMES_EDIT,
			PermissionsEnum.ORG_EXPENSES_VIEW,
			PermissionsEnum.ORG_EXPENSES_EDIT,
			PermissionsEnum.ORG_PROPOSALS_VIEW,
			PermissionsEnum.ORG_PROPOSALS_EDIT,
			PermissionsEnum.ORG_TIME_OFF_VIEW,
			PermissionsEnum.ORG_EMPLOYEES_VIEW,
			PermissionsEnum.ORG_EMPLOYEES_EDIT,
			PermissionsEnum.ORG_CANDIDATES_VIEW,
			PermissionsEnum.ORG_CANDIDATES_EDIT,
			PermissionsEnum.ORG_CANDIDATES_TASK_EDIT,
			PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT,
			PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT,
			PermissionsEnum.ORG_CANDIDATES_DOCUMENTS_VIEW,
			PermissionsEnum.ORG_USERS_VIEW,
			PermissionsEnum.ORG_USERS_EDIT,
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.POLICY_EDIT,
			PermissionsEnum.POLICY_VIEW,
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
			PermissionsEnum.CHANGE_SELECTED_CANDIDATE,
			PermissionsEnum.CHANGE_SELECTED_ORGANIZATION,
			PermissionsEnum.CHANGE_ROLES_PERMISSIONS,
			PermissionsEnum.ORG_INVITE_VIEW,
			PermissionsEnum.ORG_INVITE_EDIT,
			PermissionsEnum.ACCESS_PRIVATE_PROJECTS,
			PermissionsEnum.TIMESHEET_EDIT_TIME,
			PermissionsEnum.PUBLIC_PAGE_EDIT,
			PermissionsEnum.INVOICES_VIEW,
			PermissionsEnum.INVOICES_EDIT
		]
	},
	{
		role: RolesEnum.DATA_ENTRY,
		defaultEnabledPermissions: [
			PermissionsEnum.ORG_EXPENSES_EDIT,
			PermissionsEnum.ORG_EXPENSES_VIEW,
			PermissionsEnum.ORG_INCOMES_EDIT,
			PermissionsEnum.ORG_INCOMES_VIEW,
			PermissionsEnum.CHANGE_SELECTED_ORGANIZATION,
			PermissionsEnum.INVOICES_VIEW,
			PermissionsEnum.INVOICES_EDIT,
			PermissionsEnum.ORG_CANDIDATES_TASK_EDIT,
			PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT,
			PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT
		]
	},
	{
		role: RolesEnum.EMPLOYEE,
		defaultEnabledPermissions: [
			PermissionsEnum.ADMIN_DASHBOARD_VIEW,
			PermissionsEnum.ORG_PROPOSALS_VIEW,
			PermissionsEnum.ORG_TIME_OFF_VIEW
		]
	},
	{
		role: RolesEnum.CANDIDATE,
		defaultEnabledPermissions: [
			PermissionsEnum.ADMIN_DASHBOARD_VIEW,
			PermissionsEnum.ORG_PROPOSALS_VIEW,
			PermissionsEnum.ORG_TIME_OFF_VIEW
		]
	}
];

export const createRolePermissions = async (
	connection: Connection,
	roles: Role[],
	tenants: Tenant[]
): Promise<RolePermissions[]> => {
	const rolePermissions: RolePermissions[] = [];

	tenants.forEach((t) => {
		defaultRolePermissions.forEach((r) => {
			const role = roles.find(
				(dbRole) =>
					dbRole.name === r.role && dbRole.tenant.name === t.name
			);
			if (role) {
				r.defaultEnabledPermissions.forEach((p) => {
					const rolePermission = new RolePermissions();
					rolePermission.roleId = role.id;
					rolePermission.permission = p;
					rolePermission.enabled = true;
					rolePermission.tenant = role.tenant;
					rolePermissions.push(rolePermission);
				});
			}
		});
	});

	await connection
		.createQueryBuilder()
		.insert()
		.into(RolePermissions)
		.values(rolePermissions)
		.execute();

	return rolePermissions;
};

// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { DataSource } from 'typeorm';
import { IRole, ITenant, IRolePermission, PermissionsEnum } from '@gauzy/contracts';
import { environment } from '@gauzy/config';
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions';
import { RolePermission } from './role-permission.entity';
import { getDeclaredPermissionValues, getDeclaredPermissions } from '../plugin-contributions/plugin-declarations';

/**
 * The permission values the compiled catalogue declares.
 *
 * A permission a plugin declares reaches this seed as a string. Membership here is what tells such
 * a value back into the enum member the platform's own permission lists are written with.
 */
const BUILT_IN_PERMISSION_VALUES: ReadonlySet<string> = new Set<string>(Object.values(PermissionsEnum));

/**
 * Whether a permission value is one the compiled catalogue declares.
 *
 * @param value The permission value.
 * @returns True when the value is a member of `PermissionsEnum`.
 */
const isBuiltInPermission = (value: string): value is PermissionsEnum => BUILT_IN_PERMISSION_VALUES.has(value);

/**
 * The complete permission catalogue for a fresh installation.
 *
 * The platform's own permissions are compiled into an enum; a permission declared by a plugin is a
 * string. A role is provisioned with both, because a plugin that is loaded but grants no role its
 * permission would expose a capability nobody can reach. A declared permission is granted only to a
 * role the declaration names, so loading a plugin never widens an existing role on its own.
 *
 * @returns Every permission value a role may be provisioned with.
 */
const getPermissionCatalogue = (): string[] => {
	const builtIn = [...BUILT_IN_PERMISSION_VALUES];
	const declared = getDeclaredPermissionValues();

	return [...new Set([...builtIn, ...declared])];
};

/**
 * Creates role permissions for each tenant and role.
 *
 * @param {DataSource} dataSource - The data source to interact with the database.
 * @param {IRole[]} roles - The list of roles to create permissions for.
 * @param {ITenant[]} tenants - The list of tenants for whom to create role permissions.
 */
export const createRolePermissions = async (
	dataSource: DataSource,
	roles: IRole[],
	tenants: ITenant[]
): Promise<void> => {
	// Permissions that should be denied in DEMO mode
	const deniedPermissions = new Set([PermissionsEnum.ACCESS_DELETE_ACCOUNT, PermissionsEnum.ACCESS_DELETE_ALL_DATA]);

	for (const tenant of tenants) {
		const rolePermissions: IRolePermission[] = [];

		// Loop through each default role permission configuration
		for (const { role: roleEnum, defaultEnabledPermissions } of DEFAULT_ROLE_PERMISSIONS) {
			// Find the corresponding role for the current tenant
			const role = roles.find((dbRole: IRole) => dbRole.name === roleEnum && dbRole.tenant.name === tenant.name);

			if (role) {
				// Filter permissions, excluding denied permissions in DEMO mode
				const permissions = environment.demo
					? getPermissionCatalogue().filter((permission) => !deniedPermissions.has(permission as PermissionsEnum))
					: getPermissionCatalogue();

				// A permission a plugin declared for this role is granted the same way a built-in one
				// is; nothing else about the role changes, so loading a plugin cannot widen a role
				// that the declaration did not name.
				const declaredForRole = getDeclaredPermissions()
					.filter((declaration) => (declaration.defaultFor ?? []).includes(roleEnum))
					.map((declaration) => declaration.value);

				// Create RolePermission objects and add them to the array
				rolePermissions.push(
					...permissions.map((permission) => {
						const rolePermission = new RolePermission();
						rolePermission.role = role;
						rolePermission.permission = permission;
						// The role's own list holds compiled members, so a value the compiled enum does
						// not declare could never be in it: the membership test states which values the
						// lookup is defined for rather than casting a declared one into the enum.
						rolePermission.enabled =
							(isBuiltInPermission(permission) && defaultEnabledPermissions.includes(permission)) ||
							declaredForRole.includes(permission);
						rolePermission.tenant = tenant;
						return rolePermission;
					})
				);
			}
		}

		// Save all role permissions in one batch for the current tenant
		await dataSource.manager.save(rolePermissions);
	}
};

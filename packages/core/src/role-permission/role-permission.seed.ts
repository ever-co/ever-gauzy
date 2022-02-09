// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { IRole, ITenant, IRolePermission, PermissionsEnum } from '@gauzy/contracts';
import { Brackets, Connection, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions';
import { RolePermission } from './role-permission.entity';
import { Role, Tenant } from './../core/entities/internal';

export const createRolePermissions = async (
	connection: Connection,
	roles: IRole[],
	tenants: ITenant[],
	isDemo: boolean
): Promise<IRolePermission[]> => {
	
	// removed permissions for all users in DEMO mode
	const deniedPermissions = [
		PermissionsEnum.ACCESS_DELETE_ACCOUNT,
		PermissionsEnum.ACCESS_DELETE_ALL_DATA
	];

	const rolePermissions: IRolePermission[] = [];
	for (const tenant of tenants) {
		DEFAULT_ROLE_PERMISSIONS.forEach(({ role: roleEnum, defaultEnabledPermissions }) => {
			const role = roles.find(
				(dbRole) => dbRole.name === roleEnum && dbRole.tenant.name === tenant.name
			);
			if (role) {
				defaultEnabledPermissions
					.filter((permission) => isDemo ? !deniedPermissions.includes(permission) : true)
					.forEach((permission) => {
						const rolePermission = new RolePermission();
						rolePermission.role = role;
						rolePermission.permission = permission;
						rolePermission.enabled = true;
						rolePermission.tenant = tenant;

						rolePermissions.push(rolePermission);
					});
			}
		});
	}
	return await connection.manager.save(rolePermissions);
};


export const reloadRolePermissions = async (
	connection: Connection,
	isDemo: boolean
) => {
	// removed permissions for all users in DEMO mode
	const deniedPermissions = [
		PermissionsEnum.ACCESS_DELETE_ACCOUNT,
		PermissionsEnum.ACCESS_DELETE_ALL_DATA
	];

	const tenants = await connection.getRepository(Tenant).find();
	for await (const tenant of tenants) {
		const rolePermissions: IRolePermission[] = [];
		const roles = await connection.getRepository(Role).find({
			tenant
		});

		for await (const { role: roleEnum, defaultEnabledPermissions } of DEFAULT_ROLE_PERMISSIONS) {
			for await (const permission of defaultEnabledPermissions.filter((permission) => isDemo ? !deniedPermissions.includes(permission) : true)) {
				const existPermission = await connection.getRepository(RolePermission).findOne({
					join: {
						alias: 'role_permission',
						innerJoin: {
							role: 'role_permission.role'
						}
					},
					where: (query: SelectQueryBuilder<RolePermission>) => {
						query.andWhere(
							new Brackets((qb: WhereExpressionBuilder) => { 
								qb.andWhere(`"${query.alias}"."tenantId" =:tenantId`, { tenantId: tenant.id });
								qb.andWhere(`"${query.alias}"."permission" =:permission`, { permission });
								qb.andWhere(`"role"."name" =:roleEnum`, { roleEnum });
							})
						);
					}
				});
				if (!existPermission) {
					const role = roles.find((dbRole) => dbRole.name === roleEnum);
					console.log('Unauthorized access blocked permission', {
						permission,
						enabled: true,
						role,
						tenant
					});
					const rolePermission = new RolePermission({
						permission,
						enabled: true,
						role,
						tenant
					});
					if (role) {
						rolePermissions.push(rolePermission);
					}
				}
			} 
		}
		await connection.getRepository(RolePermission).save(rolePermissions);
	}
}

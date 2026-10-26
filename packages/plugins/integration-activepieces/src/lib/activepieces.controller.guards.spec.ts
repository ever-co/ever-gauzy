/**
 * The ActivePieces routes check the caller's own role.
 *
 * `TenantPermissionGuard` asks only whether some role of the tenant holds a permission, so with it alone the
 * `@Permissions(INTEGRATION_*)` the routes state were met by the tenant's ADMIN role for every caller: an EMPLOYEE
 * could replace the tenant's API key and connection, delete it, and edit or rotate its MCP servers.
 * `PermissionGuard` is what checks the caller's role, as on the other integration controllers.
 */
jest.mock('@gauzy/core', () => {
	class TenantPermissionGuard {}
	class PermissionGuard {}
	const { SetMetadata } = jest.requireActual('@nestjs/common');
	const { PERMISSIONS_METADATA } = jest.requireActual('@gauzy/constants');

	return {
		TenantPermissionGuard,
		PermissionGuard,
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		UUIDValidationPipe: class {},
		TenantOrganizationBaseDTO: class {}
	};
});
jest.mock('./activepieces.service', () => ({ ActivepiecesService: class {} }));
jest.mock('./activepieces-mcp.service', () => ({ ActivepiecesMcpService: class {} }));
jest.mock('./activepieces-platform.service', () => ({ ActivepiecesPlatformService: class {} }));

import { GUARDS_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { ActivepiecesController } from './activepieces.controller';
import { ActivepiecesMcpController } from './activepieces-mcp.controller';
import { ActivepiecesOperatorGuard } from './activepieces-operator.guard';
import { ActivepiecesPlatformController } from './activepieces-platform.controller';

describe.each([
	['ActivepiecesController', ActivepiecesController],
	['ActivepiecesMcpController', ActivepiecesMcpController]
])('%s — the caller’s own permissions', (_name, controller: any) => {
	it('runs PermissionGuard after TenantPermissionGuard on every route', () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, controller)).toEqual([TenantPermissionGuard, PermissionGuard]);
	});

	it('states a permission on every route', () => {
		const routes = Object.getOwnPropertyNames(controller.prototype).filter(
			(name) => Reflect.getMetadata(METHOD_METADATA, controller.prototype[name]) !== undefined
		);

		expect(routes.length).toBeGreaterThan(0);
		for (const route of routes) {
			expect([route, Reflect.getMetadata(PERMISSIONS_METADATA, controller.prototype[route])]).toEqual([
				route,
				expect.arrayContaining([expect.stringMatching(/^INTEGRATION_/)])
			]);
		}
	});
});

/**
 * The platform routes act under the installation's Activepieces platform key without a tenant's project pinned, so on
 * top of the caller's own permissions they are the operator's only (`EVER_OPERATOR_USER_IDS`).
 */
describe('ActivepiecesPlatformController — the operator only', () => {
	const controller: any = ActivepiecesPlatformController;

	it('runs PermissionGuard, then the operator check, after TenantPermissionGuard on every route', () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, controller)).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			ActivepiecesOperatorGuard
		]);
	});

	it('states a permission on every route', () => {
		const routes = Object.getOwnPropertyNames(controller.prototype).filter(
			(name) => Reflect.getMetadata(METHOD_METADATA, controller.prototype[name]) !== undefined
		);

		expect(routes.length).toBeGreaterThan(0);
		for (const route of routes) {
			expect([route, Reflect.getMetadata(PERMISSIONS_METADATA, controller.prototype[route])]).toEqual([
				route,
				expect.arrayContaining([expect.stringMatching(/^INTEGRATION_/)])
			]);
		}
	});
});

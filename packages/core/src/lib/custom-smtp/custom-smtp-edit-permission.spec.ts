/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { HttpStatus, RequestMethod } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGroups, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { DEFAULT_ROLE_PERMISSIONS } from '../role-permission/default-role-permissions';
import { CustomSmtpController } from './custom-smtp.controller';
import { CustomSmtpResolver } from './custom-smtp.resolver';

/**
 * §7.65 item 4 / owner decision 5 (2026-10-13): the custom-SMTP family had a single grant, `CUSTOM_SMTP_VIEW`,
 * and every route of `/api/smtp` — the creation, the edit, the removal and the soft-delete/recover pair
 * included — ran under it, so the pair could not be given "the controller's own edit grant": there was none.
 * `CUSTOM_SMTP_EDIT` is that grant. The writes require it on both surfaces; the reads and the validator (which
 * stores nothing) keep `CUSTOM_SMTP_VIEW`; the roles that hold the read grant by default hold the edit grant
 * too, and existing tenants get it wherever a role holds the read grant (migration
 * `1791000000573-GrantCustomSmtpEditPermission`), so nobody who could save SMTP settings yesterday loses it.
 */
const CUSTOM_SMTP_EDIT = 'CUSTOM_SMTP_EDIT' as PermissionsEnum;

const WRITES: ReadonlyArray<{ field: string; handler: string }> = [
	{ field: 'createSmtpSetting', handler: 'create' },
	{ field: 'updateSmtpSetting', handler: 'update' },
	{ field: 'deleteSmtpSetting', handler: 'delete' },
	{ field: 'softDeleteSmtpSetting', handler: 'softRemove' },
	{ field: 'recoverSmtpSetting', handler: 'softRecover' }
];

const READS: ReadonlyArray<{ field: string; handler: string }> = [
	{ field: 'customSmtpSettings', handler: 'findAll' },
	{ field: 'customSmtpSetting', handler: 'findById' },
	{ field: 'customSmtpSettingCount', handler: 'getCount' },
	{ field: 'smtpSetting', handler: 'getSmtpSetting' },
	{ field: 'validateSmtpSetting', handler: 'validateSmtpSetting' }
];

function routeGrant(handler: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, (CustomSmtpController.prototype as any)[handler]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, CustomSmtpController)
	);
}

function fieldGrant(field: string): unknown {
	return (
		Reflect.getMetadata(PERMISSIONS_METADATA, (CustomSmtpResolver.prototype as any)[field]) ??
		Reflect.getMetadata(PERMISSIONS_METADATA, CustomSmtpResolver)
	);
}

describe('CUSTOM_SMTP_EDIT — the custom SMTP family has a write grant', () => {
	it('is a permission of the catalogue, administered with its read sibling', () => {
		expect((PermissionsEnum as Record<string, string>)['CUSTOM_SMTP_EDIT']).toBe('CUSTOM_SMTP_EDIT');
		expect(PermissionGroups.ADMINISTRATION).toEqual(expect.arrayContaining([PermissionsEnum.CUSTOM_SMTP_VIEW, CUSTOM_SMTP_EDIT]));
	});

	it('is granted by default to every role the read grant is granted to', () => {
		const holders = DEFAULT_ROLE_PERMISSIONS.filter(({ defaultEnabledPermissions }) =>
			defaultEnabledPermissions.includes(PermissionsEnum.CUSTOM_SMTP_VIEW)
		).map(({ role }) => role);

		// The control: the two administrative roles are the read grant's holders.
		expect(holders.sort()).toEqual([RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN].sort());
		for (const { role, defaultEnabledPermissions } of DEFAULT_ROLE_PERMISSIONS) {
			expect({ role, edit: defaultEnabledPermissions.includes(CUSTOM_SMTP_EDIT) }).toEqual({
				role,
				edit: holders.includes(role)
			});
		}
	});
});

describe('CustomSmtpController / CustomSmtpResolver — writes require CUSTOM_SMTP_EDIT, reads keep CUSTOM_SMTP_VIEW', () => {
	it.each(WRITES.map(({ handler }) => handler))('REST %s requires CUSTOM_SMTP_EDIT', (handler) => {
		expect(routeGrant(handler)).toEqual([CUSTOM_SMTP_EDIT]);
	});

	it.each(WRITES.map(({ field }) => field))('GraphQL %s requires CUSTOM_SMTP_EDIT, as its route does', (field) => {
		const route = WRITES.find((write) => write.field === field)!.handler;

		expect(fieldGrant(field)).toEqual([CUSTOM_SMTP_EDIT]);
		expect(fieldGrant(field)).toEqual(routeGrant(route));
	});

	it.each(READS.map(({ field }) => field))('%s keeps the read grant on both surfaces', (field) => {
		const route = READS.find((read) => read.field === field)!.handler;

		expect(routeGrant(route)).toEqual([PermissionsEnum.CUSTOM_SMTP_VIEW]);
		expect(fieldGrant(field)).toEqual([PermissionsEnum.CUSTOM_SMTP_VIEW]);
	});

	it('serves the restated inherited routes where the CRUD base served them', () => {
		const expected: Record<string, [RequestMethod, string]> = {
			delete: [RequestMethod.DELETE, ':id'],
			softRemove: [RequestMethod.DELETE, ':id/soft'],
			softRecover: [RequestMethod.PUT, ':id/recover']
		};

		for (const [handler, [method, path]] of Object.entries(expected)) {
			const route = (CustomSmtpController.prototype as any)[handler];

			expect(Object.prototype.hasOwnProperty.call(CustomSmtpController.prototype, handler)).toBe(true);
			expect(Reflect.getMetadata(METHOD_METADATA, route)).toBe(method);
			expect(Reflect.getMetadata(PATH_METADATA, route)).toBe(path);
			expect(Reflect.getMetadata(HTTP_CODE_METADATA, route)).toBe(HttpStatus.ACCEPTED);
		}
	});

	it('reaches the service methods the inherited routes reached', async () => {
		const crudService = {
			delete: jest.fn().mockResolvedValue({ affected: 1 }),
			softRemove: jest.fn().mockResolvedValue({ id: 'smtp-1' }),
			softRecover: jest.fn().mockResolvedValue({ id: 'smtp-1' })
		};
		const controller = Object.create(CustomSmtpController.prototype);
		Object.defineProperty(controller, 'crudService', { value: crudService });

		await expect(controller.delete('smtp-1')).resolves.toEqual({ affected: 1 });
		await expect(controller.softRemove('smtp-1')).resolves.toEqual({ id: 'smtp-1' });
		await expect(controller.softRecover('smtp-1')).resolves.toEqual({ id: 'smtp-1' });
		expect(crudService.delete).toHaveBeenCalledWith('smtp-1');
		expect(crudService.softRemove).toHaveBeenCalledWith('smtp-1', []);
		expect(crudService.softRecover).toHaveBeenCalledWith('smtp-1', []);
	});
});

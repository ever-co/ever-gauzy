/**
 * Subscribing to the organization's Zapier REST hooks needs the caller's own role to manage integrations.
 *
 * The routes ran behind the global `AuthGuard` alone, so any signed-in employee could subscribe a URL of their
 * own to `timer.status.changed` and receive every employee's time log as it was started or stopped.
 */
jest.mock('@gauzy/core', () => {
	class PermissionGuard {}
	const { SetMetadata } = jest.requireActual('@nestjs/common');
	const { PERMISSIONS_METADATA } = jest.requireActual('@gauzy/constants');

	return {
		PermissionGuard,
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions)
	};
});
jest.mock('./zapier.service', () => ({ ZapierService: class {} }));
jest.mock('./zapier-webhook.service', () => ({ ZapierWebhookService: class {} }));
jest.mock('./zapier-webhook-subscription.entity', () => ({ ZapierWebhookSubscription: class {} }));

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard } from '@gauzy/core';
import { ZapierWebhookController } from './zapier-webhook.controller';

describe('ZapierWebhookController — the caller’s own permissions', () => {
	it("checks the caller's role with PermissionGuard", () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, ZapierWebhookController)).toEqual([PermissionGuard]);
	});

	it('requires the permissions of the Zapier settings routes', () => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ZapierWebhookController)).toEqual([
			PermissionsEnum.INTEGRATION_ADD,
			PermissionsEnum.INTEGRATION_EDIT
		]);
	});
});

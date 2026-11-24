import 'reflect-metadata';
import '../core/entities/internal';

import { PERMISSIONS_METADATA, PUBLIC_METHOD_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { InviteController } from './invite.controller';
import { InviteResolver } from './invite.resolver';

/**
 * A person reads and answers the invitations addressed to their own e-mail whatever their role. An account that
 * already exists accepts from its own session only (ever-co/ever-gauzy#12147), and the Manager, Viewer and Candidate
 * roles hold neither ORG_INVITE_VIEW nor ORG_INVITE_EDIT: with a permission on these two routes they could not accept
 * at all. The routes stay behind the session and the tenant: they are not public.
 */
const OWN_ROUTES = ['getCurrentUserInvites', 'handleInvitationResponse'];
const OWN_FIELDS = ['myInvites', 'handleInvitationResponse'];

const handlerOf = (owner: { prototype: object }, name: string) => (owner.prototype as Record<string, unknown>)[name];

describe.each([
	['routes', InviteController, OWN_ROUTES],
	['GraphQL fields', InviteResolver, OWN_FIELDS]
])("the %s of a person's own invitations", (_kind, owner, names) => {
	it.each(names)('%s asks for no permission', (name) => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, handlerOf(owner, name) as object)).toBeUndefined();
	});

	it.each(names)('%s still needs a session of the tenant', (name) => {
		const handler = handlerOf(owner, name) as object;

		expect(Reflect.getMetadata('__guards__', handler)).toEqual([TenantPermissionGuard, PermissionGuard]);
		expect(Reflect.getMetadata(PUBLIC_METHOD_METADATA, handler)).toBeUndefined();
	});
});

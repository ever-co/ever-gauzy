// Only what the OAuth service and its controller use: keep the rest of @gauzy/core (database, seeds) out of this test
jest.mock('@gauzy/core', () => {
	const { SetMetadata } = jest.requireActual('@nestjs/common');
	return {
		IntegrationService: class IntegrationService {},
		IntegrationSettingService: class IntegrationSettingService {},
		IntegrationTenantService: class IntegrationTenantService {},
		IntegrationTenantUpdateOrCreateCommand: class IntegrationTenantUpdateOrCreateCommand {},
		RequestContext: { currentTenantId: jest.fn() },
		DEFAULT_ENTITY_SETTINGS: [],
		PROJECT_TIED_ENTITIES: [],
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		Permissions: (...permissions: string[]) => SetMetadata('permissions', permissions)
	};
});
jest.mock('@gauzy/common', () => {
	const { SetMetadata } = jest.requireActual('@nestjs/common');
	return { Public: () => SetMetadata('public', true) };
});
jest.mock('@gauzy/config', () => ({ ConfigService: class ConfigService {} }));
jest.mock('./make-com.service', () => ({ MakeComService: class MakeComService {} }));

import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, RequestContext, TenantPermissionGuard } from '@gauzy/core';
import { MakeComOAuthService } from './make-com-oauth.service';
import { MakeComAuthorizationController } from './make-com-authorization.controller';

const TENANT_ID = 'a0000000-0000-4000-8000-00000000000a';
const ORGANIZATION_ID = 'b0000000-0000-4000-8000-00000000000b';

function serviceUnderTest() {
	const cache = new Map<string, unknown>();
	const cacheManager = {
		get: jest.fn(async (key: string) => cache.get(key)),
		set: jest.fn(async (key: string, value: unknown) => void cache.set(key, value)),
		del: jest.fn(async (key: string) => void cache.delete(key))
	};
	const config = {
		get: jest.fn(() => ({
			clientId: 'client-id',
			clientSecret: 'client-secret',
			redirectUri: 'https://api.example/api/integration/make-com/oauth/callback'
		}))
	};
	const httpService = { post: jest.fn() };
	const service = new MakeComOAuthService(
		httpService as never,
		config as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{ execute: jest.fn() } as never,
		cacheManager as never
	);

	return { service, cacheManager, httpService };
}

function stateOf(authorizationUrl: string): string {
	return new URL(authorizationUrl).searchParams.get('state') as string;
}

function decode(state: string) {
	return JSON.parse(Buffer.from(state, 'base64url').toString());
}

/**
 * The Make.com OAuth `state` is the key the PKCE verifier is cached under and the record of the tenant the
 * callback saves the tokens to. It used to be `base64url({ tenantId, organizationId })` and nothing else, and the
 * route that issued it was public: anyone could start a flow, and the anonymous one named no tenant at all.
 */
describe('MakeComOAuthService state', () => {
	const currentTenantId = RequestContext.currentTenantId as jest.Mock;

	afterEach(() => currentTenantId.mockReset());

	it('refuses to start a flow without a signed-in tenant', async () => {
		currentTenantId.mockReturnValue(null);
		const { service, cacheManager } = serviceUnderTest();

		await expect(service.getAuthorizationUrl({ organizationId: ORGANIZATION_ID })).rejects.toBeInstanceOf(
			UnauthorizedException
		);
		expect(cacheManager.set).not.toHaveBeenCalled();
	});

	it('issues an unguessable state of its own to every flow, cached under its own key', async () => {
		currentTenantId.mockReturnValue(TENANT_ID);
		const { service, cacheManager } = serviceUnderTest();

		const first = stateOf(await service.getAuthorizationUrl({ organizationId: ORGANIZATION_ID }));
		const second = stateOf(await service.getAuthorizationUrl({ organizationId: ORGANIZATION_ID }));

		expect(first).not.toBe(second);
		expect(decode(first)).toEqual({
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			nonce: expect.stringMatching(/^[\w-]{22}$/)
		});
		// Two flows of one organization no longer overwrite each other's PKCE verifier.
		const keys = cacheManager.set.mock.calls.map(([key]) => key);
		expect(new Set(keys).size).toBe(2);
		expect((await service.verifyState(first)).isValid).toBe(true);
		expect((await service.verifyState(second)).isValid).toBe(true);
	});

	it('does not save tokens for a state that names no tenant', async () => {
		const { service, httpService } = serviceUnderTest();
		const tenantless = Buffer.from(JSON.stringify({ tenantId: null })).toString('base64url');

		await expect(service.exchangeCodeForToken('code', tenantless, 'verifier')).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(httpService.post).not.toHaveBeenCalled();
	});
});

describe('MakeComAuthorizationController', () => {
	const authorize = MakeComAuthorizationController.prototype.authorize;
	const callback = MakeComAuthorizationController.prototype.callback;

	it('keeps the callback, and only the callback, public', () => {
		expect(Reflect.getMetadata('public', MakeComAuthorizationController)).toBeUndefined();
		expect(Reflect.getMetadata('public', callback)).toBe(true);
		expect(Reflect.getMetadata('public', authorize)).toBeUndefined();
	});

	it('starts a flow only for a user who may add an integration', () => {
		expect(Reflect.getMetadata('__guards__', authorize)).toEqual([TenantPermissionGuard, PermissionGuard]);
		expect(Reflect.getMetadata('permissions', authorize)).toEqual([
			PermissionsEnum.INTEGRATION_ADD,
			PermissionsEnum.INTEGRATION_EDIT
		]);
	});
});

import type { OAuthAppPendingRequest, SocialAuthService } from '../social-auth.service';
import { OAuthAppController } from './oauth-app.controller';

// The controller only needs the service as a DI token and `@Public()` as a decorator; loading the real ones would pull
// `@gauzy/config` (the whole environment) and `@gauzy/common` into a unit test.
jest.mock('../social-auth.service', () => ({ SocialAuthService: class {} }));
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

/**
 * Approving an OAuth app hands the organization of the approving session to the code issuer, so the app's access
 * token is scoped to the organization the user approved it in rather than to their first employee record.
 */

const PENDING: OAuthAppPendingRequest = {
	requestId: 'request-1',
	clientId: 'zapier-app',
	redirectUri: 'https://zapier.com/dashboard/auth/oauth/return/App123/',
	scope: 'zap',
	state: 'state-1',
	createdAt: Date.now()
};

function build() {
	const service = {
		getOAuthAppPendingRequest: jest.fn(async () => PENDING),
		deleteOAuthAppPendingRequest: jest.fn(async () => undefined),
		createOAuthAppAuthorizationCode: jest.fn(async () => 'v1.code.signature')
	};
	const controller = new OAuthAppController(service as unknown as SocialAuthService);

	return { controller, service };
}

describe('OAuthAppController.approveAuthorize', () => {
	it('issues the code for the organization of the approving session', async () => {
		const { controller, service } = build();

		const answer = await controller.approveAuthorize(
			{ request_id: PENDING.requestId },
			{ user: { id: 'user-1', tenantId: 'tenant-1', lastOrganizationId: 'org-b' } }
		);

		expect(service.createOAuthAppAuthorizationCode).toHaveBeenCalledWith(
			expect.objectContaining({ userId: 'user-1', tenantId: 'tenant-1', organizationId: 'org-b' })
		);
		expect(answer.redirect_url).toContain('code=v1.code.signature');
		expect(answer.redirect_url).toContain('state=state-1');
	});

	it('states no organization for a session that has none', async () => {
		const { controller, service } = build();

		await controller.approveAuthorize(
			{ request_id: PENDING.requestId },
			{ user: { id: 'user-1', tenantId: 'tenant-1' } }
		);

		expect(service.createOAuthAppAuthorizationCode).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: null })
		);
	});
});

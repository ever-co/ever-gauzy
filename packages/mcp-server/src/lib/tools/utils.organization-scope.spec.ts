/**
 * A tool's organization and tenant: the ones the caller names, else the signed-in user's.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { authManager } from '../common/auth-manager';
import { resolveOrganizationScope } from './utils';

const SIGNED_IN_ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const SIGNED_IN_TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_ORGANIZATION = '00000000-0000-4000-8000-000000000012';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000011';

describe('resolveOrganizationScope', () => {
	afterEach(() => jest.restoreAllMocks());

	it("takes the signed-in user's organization and tenant when the caller names none", () => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue({
			organizationId: SIGNED_IN_ORGANIZATION,
			tenantId: SIGNED_IN_TENANT
		});

		expect(resolveOrganizationScope()).toEqual({
			organizationId: SIGNED_IN_ORGANIZATION,
			tenantId: SIGNED_IN_TENANT
		});
	});

	it('keeps the organization and tenant the caller names', () => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue({
			organizationId: SIGNED_IN_ORGANIZATION,
			tenantId: SIGNED_IN_TENANT
		});

		expect(resolveOrganizationScope(OTHER_ORGANIZATION, OTHER_TENANT)).toEqual({
			organizationId: OTHER_ORGANIZATION,
			tenantId: OTHER_TENANT
		});
		expect(resolveOrganizationScope(OTHER_ORGANIZATION)).toEqual({
			organizationId: OTHER_ORGANIZATION,
			tenantId: SIGNED_IN_TENANT
		});
	});

	it('needs no one signed in when the caller names the organization, and leaves an unknown tenant out', () => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue({});

		expect(resolveOrganizationScope(OTHER_ORGANIZATION)).toEqual({ organizationId: OTHER_ORGANIZATION });
	});

	it('refuses when no organization is named and none is signed in', () => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue({ tenantId: SIGNED_IN_TENANT });

		expect(() => resolveOrganizationScope()).toThrow('Organization ID not available');
	});
});

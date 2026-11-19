/**
 * The organization contact tools required an organization (and, for a bulk update, a tenant) of every caller, where
 * the other tools take the signed-in user's. They now take it the same way when the caller leaves it out, and keep the
 * one a caller names.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerOrganizationContactTools } from './organization-contact';

const SIGNED_IN_ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const SIGNED_IN_TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_ORGANIZATION = '00000000-0000-4000-8000-000000000012';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000011';
const CONTACT = '00000000-0000-4000-8000-000000000050';

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** The organization contact tools, by name, as a server would be handed their schemas and callbacks. */
function contactTools(): Map<string, RegisteredTool> {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(name, { inputSchema: config.inputSchema, callback })
	};
	registerOrganizationContactTools(server as never);
	return tools;
}

/** Calls a tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown>) {
	const tool = contactTools().get(name) as RegisteredTool;
	const parsed = tool.inputSchema.parse(args);
	return tool.callback(parsed);
}

describe('organization contact tools — the organization and tenant they act for', () => {
	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue({
			organizationId: SIGNED_IN_ORGANIZATION,
			tenantId: SIGNED_IN_TENANT
		});
	});

	afterEach(() => jest.restoreAllMocks());

	it("counts the signed-in user's contacts when no organization or tenant is named", async () => {
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue(3 as never);

		await call('get_organization_contact_count', { contactType: 'CLIENT' });

		expect(get).toHaveBeenCalledWith('/api/organization-contact/count', {
			params: { organizationId: SIGNED_IN_ORGANIZATION, tenantId: SIGNED_IN_TENANT, contactType: 'CLIENT' }
		});
	});

	it('counts in the organization and tenant a caller names, as before', async () => {
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue(3 as never);

		await call('get_organization_contact_count', { organizationId: OTHER_ORGANIZATION, tenantId: OTHER_TENANT });

		expect(get).toHaveBeenCalledWith('/api/organization-contact/count', {
			params: { organizationId: OTHER_ORGANIZATION, tenantId: OTHER_TENANT }
		});
	});

	it("creates a contact in the signed-in user's organization when its data names none", async () => {
		const post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: CONTACT } as never);

		await call('create_organization_contact', {
			contact_data: { name: 'Harbor Supplies', primaryEmail: 'ops@example.com' }
		});

		expect(post).toHaveBeenCalledWith('/api/organization-contact', {
			name: 'Harbor Supplies',
			primaryEmail: 'ops@example.com',
			organizationId: SIGNED_IN_ORGANIZATION,
			tenantId: SIGNED_IN_TENANT
		});
	});

	it('creates a contact in the organization its data names, as before', async () => {
		const post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: CONTACT } as never);

		await call('create_organization_contact', {
			contact_data: { name: 'Harbor Supplies', organizationId: OTHER_ORGANIZATION }
		});

		expect(post).toHaveBeenCalledWith('/api/organization-contact', {
			name: 'Harbor Supplies',
			organizationId: OTHER_ORGANIZATION,
			tenantId: SIGNED_IN_TENANT
		});
	});

	it('updates contacts in bulk under the organization and tenant each names, else the signed-in ones', async () => {
		const put = jest.spyOn(apiClient, 'put').mockResolvedValue([] as never);

		await call('bulk_update_organization_contacts', {
			contacts: [
				{ id: CONTACT, name: 'Harbor Supplies' },
				{ id: CONTACT, name: 'Blue Ridge Studio', organizationId: OTHER_ORGANIZATION, tenantId: OTHER_TENANT }
			]
		});

		// Each contact goes through the route of one contact (#12092): the API serves no bulk update.
		expect(put.mock.calls).toEqual([
			[
				`/api/organization-contact/${CONTACT}`,
				{ name: 'Harbor Supplies', organizationId: SIGNED_IN_ORGANIZATION, tenantId: SIGNED_IN_TENANT }
			],
			[
				`/api/organization-contact/${CONTACT}`,
				{ name: 'Blue Ridge Studio', organizationId: OTHER_ORGANIZATION, tenantId: OTHER_TENANT }
			]
		]);
	});

	it('refuses, sending nothing, when no organization is named and none is signed in', async () => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue({});
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue(3 as never);

		await expect(call('get_organization_contact_count', {})).rejects.toThrow('Organization ID not available');
		expect(get).not.toHaveBeenCalled();
	});
});

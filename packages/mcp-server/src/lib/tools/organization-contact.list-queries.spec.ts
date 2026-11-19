/**
 * `GET /api/organization-contact/pagination` validates `BaseQueryDTO`: `where` is required, and a query of flat filters
 * was refused (400 "where should not be empty"). `get_organization_contacts_pagination` now sends its filters inside
 * `where`, where the route matches the name, email and phone partially, with `skip` read as a page number.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerOrganizationContactTools } from './organization-contact';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** The organization contact tools, by name, as a server would be handed their schemas and callbacks. */
function tools(): Map<string, RegisteredTool> {
	const registered = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (name: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			registered.set(name, { inputSchema: config.inputSchema, callback })
	};
	registerOrganizationContactTools(server as never);
	return registered;
}

/** Calls a tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown> = {}) {
	const tool = tools().get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

describe('organization contact list tools — the query the route validates', () => {
	let get: jest.SpyInstance;

	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
		get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it('get_organization_contacts_pagination filters inside `where`, paged by page number', async () => {
		const member = '00000000-0000-4000-8000-000000000040';
		await call('get_organization_contacts_pagination', {
			contactType: 'CLIENT',
			name: 'Acme',
			primaryEmail: 'billing@',
			primaryPhone: '555',
			members: [member],
			page: 2,
			limit: 5
		});

		expect(get).toHaveBeenCalledWith('/api/organization-contact/pagination', {
			params: {
				where: {
					...SCOPE,
					contactType: 'CLIENT',
					name: 'Acme',
					primaryEmail: 'billing@',
					primaryPhone: '555',
					members: [member]
				},
				take: 5,
				skip: 2
			}
		});
	});

	it('get_organization_contacts_pagination keeps the organization and tenant a caller names', async () => {
		const scope = {
			organizationId: '00000000-0000-4000-8000-000000000012',
			tenantId: '00000000-0000-4000-8000-000000000011'
		};
		await call('get_organization_contacts_pagination', scope);

		expect(get).toHaveBeenCalledWith('/api/organization-contact/pagination', {
			params: { where: scope, take: 10, skip: 1 }
		});
	});
});

/**
 * Nine organization contact tools called routes the API never served: the bulk routes, `/statistics` read as a contact
 * id, and the employee, assign, projects and invite routes under a contact. The bulk tools now call the route of one
 * contact for each, the employees of a contact change through `PUT /organization-contact/employee`, its projects come
 * from the project list and its invitation from the invite route; the update by employee and the statistics, which no
 * route offers, are answered so without any request.
 *
 * Env for mcp-server module load is set in `src/test-setup.ts`.
 */
import { z } from 'zod';
import { apiClient } from '../common/api-client';
import { authManager } from '../common/auth-manager';
import { registerOrganizationContactTools } from './organization-contact';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const TENANT = '00000000-0000-4000-8000-000000000001';
const CONTACT = '00000000-0000-4000-8000-000000000050';
const OTHER_CONTACT = '00000000-0000-4000-8000-000000000051';
const EMPLOYEE = '00000000-0000-4000-8000-000000000032';
const SCOPE = { organizationId: ORGANIZATION, tenantId: TENANT };
const OTHER_ORGANIZATION = '00000000-0000-4000-8000-000000000012';

type ToolCallback = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
type RegisteredTool = { inputSchema: z.ZodType<Record<string, unknown>>; callback: ToolCallback };

/** Calls an organization contact tool with the arguments its schema parses them to, as the server does. */
async function call(name: string, args: Record<string, unknown>) {
	const tools = new Map<string, RegisteredTool>();
	const server = {
		registerTool: (tool: string, config: { inputSchema: RegisteredTool['inputSchema'] }, callback: ToolCallback) =>
			tools.set(tool, { inputSchema: config.inputSchema, callback })
	};
	registerOrganizationContactTools(server as never);
	const tool = tools.get(name) as RegisteredTool;
	return tool.callback(tool.inputSchema.parse(args));
}

/** Spies on every request method of the API client, answering each with `answer`. */
const spyOnRequests = (answer: unknown = {}) =>
	(['get', 'post', 'put', 'patch', 'delete'] as const).map((method) =>
		jest.spyOn(apiClient, method).mockResolvedValue(answer as never)
	);

describe('organization contact tools: the routes they call', () => {
	beforeEach(() => {
		jest.spyOn(authManager, 'getDefaultParams').mockReturnValue(SCOPE);
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates each contact through the route of one contact, in turn', async () => {
		const post = jest.spyOn(apiClient, 'post').mockResolvedValue({ id: CONTACT } as never);

		await call('bulk_create_organization_contacts', {
			contacts: [{ name: 'Harbor Supplies' }, { name: 'Blue Ridge Studio' }]
		});

		expect(post.mock.calls).toEqual([
			['/api/organization-contact', { name: 'Harbor Supplies', ...SCOPE }],
			['/api/organization-contact', { name: 'Blue Ridge Studio', ...SCOPE }]
		]);
	});

	it('deletes each contact by its id, in its scope, and says which one failed', async () => {
		const remove = jest
			.spyOn(apiClient, 'delete')
			.mockResolvedValueOnce({ affected: 1 } as never)
			.mockRejectedValueOnce(new Error('Request failed with status code 403'));

		await expect(call('bulk_delete_organization_contacts', { ids: [CONTACT, OTHER_CONTACT] })).rejects.toThrow(
			'Item 2 of 2 failed after 1 applied: Request failed with status code 403'
		);
		expect(remove.mock.calls).toEqual([
			[`/api/organization-contact/${CONTACT}`, { params: SCOPE }],
			[`/api/organization-contact/${OTHER_CONTACT}`, { params: SCOPE }]
		]);
	});

	it.each([
		['assign_contact_to_employee', { addedEntityIds: [CONTACT] }],
		['unassign_contact_from_employee', { removedEntityIds: [CONTACT] }]
	])('%s reads the contact in its organization, then edits its employees', async (name, change) => {
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ id: CONTACT, ...SCOPE } as never);
		const put = jest.spyOn(apiClient, 'put').mockResolvedValue(true as never);

		await call(name, { contactId: CONTACT, employeeId: EMPLOYEE });

		expect(get).toHaveBeenCalledWith(`/api/organization-contact/${CONTACT}`, {
			params: { data: JSON.stringify({ findInput: SCOPE }) }
		});
		expect(put).toHaveBeenCalledWith('/api/organization-contact/employee', {
			...SCOPE,
			member: { id: EMPLOYEE },
			...change
		});
	});

	it.each(['assign_contact_to_employee', 'unassign_contact_from_employee'])(
		'%s answers not found, writing nothing, for a contact of another organization',
		async (name) => {
			jest.spyOn(apiClient, 'get').mockResolvedValue({
				id: CONTACT,
				organizationId: OTHER_ORGANIZATION
			} as never);
			const put = jest.spyOn(apiClient, 'put').mockResolvedValue(true as never);

			await expect(call(name, { contactId: CONTACT, employeeId: EMPLOYEE })).rejects.toThrow(
				`Organization contact ${CONTACT} not found in organization ${ORGANIZATION}.`
			);
			expect(put).not.toHaveBeenCalled();
		}
	);

	it.each(['assign_contact_to_employee', 'unassign_contact_from_employee'])(
		'%s answers not found, writing nothing, for a contact the API does not find',
		async (name) => {
			jest.spyOn(apiClient, 'get').mockRejectedValue(new Error('Request failed with status code 404'));
			const put = jest.spyOn(apiClient, 'put').mockResolvedValue(true as never);

			await expect(call(name, { contactId: CONTACT, employeeId: EMPLOYEE })).rejects.toThrow('404');
			expect(put).not.toHaveBeenCalled();
		}
	);

	it("lists a contact's projects from the project list, a page at a time", async () => {
		const get = jest.spyOn(apiClient, 'get').mockResolvedValue({ items: [], total: 0 } as never);

		await call('get_contact_projects', { contactId: CONTACT, page: 3, limit: 20 });

		expect(get).toHaveBeenCalledWith('/api/organization-projects', {
			params: { ...SCOPE, where: { ...SCOPE, organizationContactId: CONTACT }, take: 20, skip: 40 }
		});
	});

	it('invites a contact by email through the invite route, in the scope its guard reads', async () => {
		const put = jest.spyOn(apiClient, 'put').mockResolvedValue({ id: CONTACT, inviteStatus: 'SENT' } as never);

		await call('invite_organization_contact', { contactId: CONTACT });

		expect(put).toHaveBeenCalledWith(`/api/invite/organization-contact/${CONTACT}`, SCOPE);
	});

	it.each([
		['update_organization_contact_by_employee', { id: CONTACT, contact_data: { name: 'Harbor' } }, 'updating'],
		['get_organization_contact_statistics', {}, 'organization contact statistics'],
		['invite_organization_contact', { contactId: CONTACT, inviteType: 'SMS' }, 'inviting a contact by SMS'],
		['invite_organization_contact', { contactId: CONTACT, customMessage: 'Welcome' }, 'a custom message']
	])('answers that %s is not offered, without any request', async (name, args, action) => {
		const requests = spyOnRequests();

		await expect(call(name, args)).rejects.toThrow(`This server does not offer ${action}`);
		for (const request of requests) {
			expect(request).not.toHaveBeenCalled();
		}
	});
});

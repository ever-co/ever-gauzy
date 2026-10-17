import '../../../core/entities/internal';

import { asTenantUser, createTenantFixture } from '../../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { OrganizationContactCreateCommand } from '../organization-contact-create.command';
import { OrganizationContactCreateHandler } from './organization-contact-create.handler';

/**
 * A contact created for projects, without members, gets the projects' members. The handler read each
 * member row's `employee`, a relation the rows are loaded without, so the contact got no members.
 */
describe('OrganizationContactCreateHandler', () => {
	const fixture = createTenantFixture();

	let restore: () => void;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it("gives a contact created for projects the projects' members, each once", async () => {
		const organizationContactService = { create: jest.fn(async (input) => input) };
		const organizationProjectService = {
			// Member rows as loaded with `relations: { members: true }`: no `employee` relation
			find: jest.fn().mockResolvedValue([
				{ id: 'project-1', members: [{ employeeId: 'employee-a' }, { employeeId: 'employee-b' }] },
				{ id: 'project-2', members: [{ employeeId: 'employee-b' }] }
			])
		};
		const contactService = { create: jest.fn().mockResolvedValue({ id: 'contact-details-1' }) };
		const handler = new OrganizationContactCreateHandler(
			organizationContactService as any,
			organizationProjectService as any,
			contactService as any
		);

		await handler.execute(
			new OrganizationContactCreateCommand({
				name: 'Acme',
				organizationId: fixture.organizationId,
				projects: [{ id: 'project-1' }, { id: 'project-2' }]
			} as any)
		);

		expect(organizationContactService.create.mock.calls[0][0].members).toEqual([
			{ id: 'employee-a' },
			{ id: 'employee-b' }
		]);
	});
});

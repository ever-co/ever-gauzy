import '../../../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';

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

	/**
	 * A caller who may create contacts but not edit them (ORG_CONTACT_ADD without ORG_CONTACT_EDIT,
	 * ever-co/ever-gauzy#5468) creates only: the create cannot reach a record that already exists.
	 */
	describe('a create-only create', () => {
		const build = (projects: Array<{ id: string; organizationContactId?: string | null }> = []) => {
			const organizationContactService = { create: jest.fn(async (input) => input) };
			const organizationProjectService = { find: jest.fn().mockResolvedValue(projects) };
			const contactService = { create: jest.fn().mockResolvedValue({ id: 'contact-details-1' }) };
			const handler = new OrganizationContactCreateHandler(
				organizationContactService as any,
				organizationProjectService as any,
				contactService as any
			);
			return { handler, organizationContactService, organizationProjectService, contactService };
		};

		it('refuses an existing contact with 403, not the catch-all 400, and writes nothing', async () => {
			const { handler, organizationContactService, contactService } = build();

			await expect(
				handler.execute(
					new OrganizationContactCreateCommand(
						{ id: 'contact-existing', name: 'Acme', organizationId: fixture.organizationId } as any,
						{ createOnly: true }
					)
				)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(contactService.create).not.toHaveBeenCalled();
			expect(organizationContactService.create).not.toHaveBeenCalled();
		});

		it('links only unassigned projects of the organization, by id', async () => {
			const { handler, organizationContactService, organizationProjectService } = build([
				{ id: 'project-1', organizationContactId: null }
			]);

			await handler.execute(
				new OrganizationContactCreateCommand(
					{
						name: 'Acme',
						organizationId: fixture.organizationId,
						members: [{ id: 'employee-a' }],
						projects: [{ id: 'project-1', name: 'Renamed', memberIds: ['employee-z'] }]
					} as any,
					{ createOnly: true }
				)
			);

			expect(organizationProjectService.find.mock.calls[0][0].where).toEqual(
				expect.objectContaining({ organizationId: fixture.organizationId })
			);
			expect(organizationContactService.create.mock.calls[0][0].projects).toEqual([{ id: 'project-1' }]);
		});

		it('leaves a create without the option exactly as it was, an existing id included', async () => {
			const { handler, organizationContactService } = build();

			await handler.execute(
				new OrganizationContactCreateCommand({
					id: 'contact-existing',
					name: 'Acme',
					organizationId: fixture.organizationId,
					members: [{ id: 'employee-a' }]
				} as any)
			);

			expect(organizationContactService.create.mock.calls[0][0].id).toBe('contact-existing');
		});
	});
});

import '../../../core/entities/internal';

import { ConflictException, ForbiddenException } from '@nestjs/common';

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
			const organizationContactService = {
				create: jest.fn(async (input) => input),
				createClaimingProjects: jest.fn(async (input) => input)
			};
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

		it('links only unassigned projects of the organization, by id, claimed with the contact and its details', async () => {
			const { handler, organizationContactService, organizationProjectService, contactService } = build([
				{ id: 'project-1', organizationContactId: null }
			]);

			await handler.execute(
				new OrganizationContactCreateCommand(
					{
						name: 'Acme',
						organizationId: fixture.organizationId,
						contact: { city: 'Sofia' },
						members: [{ id: 'employee-a' }],
						projects: [{ id: 'project-1', name: 'Renamed', memberIds: ['employee-z'] }]
					} as any,
					{ createOnly: true }
				)
			);

			expect(organizationProjectService.find.mock.calls[0][0].where).toEqual(
				expect.objectContaining({ organizationId: fixture.organizationId })
			);
			// One transaction writes the details, the contact and the links: nothing is written before it.
			expect(contactService.create).not.toHaveBeenCalled();
			expect(organizationContactService.create).not.toHaveBeenCalled();
			const [claim] = organizationContactService.createClaimingProjects.mock.calls[0];
			expect(claim.projects).toEqual([{ id: 'project-1' }]);
			expect(claim).toEqual(
				expect.objectContaining({ organizationId: fixture.organizationId, tenantId: fixture.tenantId })
			);
			expect(claim.contact).toEqual(
				expect.objectContaining({
					city: 'Sofia',
					organization: { id: fixture.organizationId },
					tenant: { id: fixture.tenantId }
				})
			);
		});

		it('answers a project another request assigned meanwhile with its 409, not the catch-all 400', async () => {
			const { handler, organizationContactService } = build([{ id: 'project-1', organizationContactId: null }]);
			organizationContactService.createClaimingProjects.mockRejectedValue(new ConflictException('claimed'));

			await expect(
				handler.execute(
					new OrganizationContactCreateCommand(
						{
							name: 'Acme',
							organizationId: fixture.organizationId,
							members: [{ id: 'employee-a' }],
							projects: [{ id: 'project-1' }]
						} as any,
						{ createOnly: true }
					)
				)
			).rejects.toBeInstanceOf(ConflictException);
		});

		it('creates a create-only contact without projects as before', async () => {
			const { handler, organizationContactService, contactService } = build();

			await handler.execute(
				new OrganizationContactCreateCommand(
					{ name: 'Acme', organizationId: fixture.organizationId, members: [{ id: 'employee-a' }] } as any,
					{ createOnly: true }
				)
			);

			expect(contactService.create).toHaveBeenCalledTimes(1);
			expect(organizationContactService.create).toHaveBeenCalledTimes(1);
			expect(organizationContactService.createClaimingProjects).not.toHaveBeenCalled();
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

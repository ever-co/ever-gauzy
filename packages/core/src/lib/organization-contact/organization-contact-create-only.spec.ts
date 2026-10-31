import { ForbiddenException } from '@nestjs/common';
import { IOrganizationContactCreateInput } from '@gauzy/contracts';
import { toCreateOnlyContactInput } from './organization-contact-create-only';

const UNASSIGNED = 'project-unassigned';
const ASSIGNED = 'project-of-another-contact';

/** The projects of the organization, with the contact each has. */
const findProjects = jest.fn(async (ids: string[]) =>
	[
		{ id: UNASSIGNED, organizationContactId: null },
		{ id: ASSIGNED, organizationContactId: 'contact-other' }
	].filter((project) => ids.includes(project.id))
);

const input = (overrides: Record<string, unknown> = {}) =>
	({
		name: 'Acme',
		organizationId: 'organization-1',
		contact: { country: 'BG', city: 'Sofia' },
		members: [{ id: 'employee-1' }],
		tags: [{ id: 'tag-1' }],
		...overrides
	}) as unknown as IOrganizationContactCreateInput;

describe('toCreateOnlyContactInput: what a caller who may create contacts but not edit them can write', () => {
	afterEach(() => findProjects.mockClear());

	it('creates a contact with its own fields, members, tags and new contact details as they are', async () => {
		const plain = input();

		await expect(toCreateOnlyContactInput(plain, findProjects)).resolves.toBe(plain);
		expect(findProjects).not.toHaveBeenCalled();
	});

	it.each([
		['an existing contact', { id: 'contact-existing' }],
		['existing contact details by id', { contactId: 'details-existing' }],
		['existing contact details inline', { contact: { id: 'details-existing', city: 'Sofia' } }],
		['new contact details given to an existing employee', { contact: { city: 'Sofia', employee: { id: 'e-1' } } }],
		[
			'new contact details given to an existing candidate',
			{ contact: { city: 'Sofia', candidate: { id: 'c-1' } } }
		],
		[
			'new contact details given to an existing contact',
			{ contact: { city: 'Sofia', organizationContact: { id: 'contact-existing' } } }
		],
		['existing invoices', { invoices: [{ id: 'invoice-1' }] }],
		['existing payments', { payments: [{ id: 'payment-1' }] }],
		['existing expenses', { expenses: [{ id: 'expense-1' }] }],
		['existing incomes', { incomes: [{ id: 'income-1' }] }],
		['existing time logs', { timeLogs: [{ id: 'time-log-1' }] }],
		['time logs stated as something other than a list', { timeLogs: { id: 'time-log-1' } }]
	])('refuses %s with 403', async (_label, overrides) => {
		await expect(toCreateOnlyContactInput(input(overrides), findProjects)).rejects.toBeInstanceOf(
			ForbiddenException
		);
	});

	it('accepts the one-to-many lists empty', async () => {
		await expect(
			toCreateOnlyContactInput(input({ invoices: [], timeLogs: [], payments: null }), findProjects)
		).resolves.toBeDefined();
	});

	it('links unassigned projects of the organization, and writes nothing else about them', async () => {
		const result = await toCreateOnlyContactInput(
			input({
				projects: [
					{
						id: UNASSIGNED,
						name: 'Renamed',
						members: [{ employeeId: 'employee-2' }],
						memberIds: ['employee-2']
					},
					{ id: UNASSIGNED }
				]
			}),
			findProjects
		);

		expect(findProjects).toHaveBeenCalledWith([UNASSIGNED]);
		expect(result.projects).toEqual([{ id: UNASSIGNED }]);
		expect(result.name).toBe('Acme');
	});

	it.each([
		['a project that already has a contact', [{ id: ASSIGNED }]],
		['a project the organization does not have', [{ id: 'project-elsewhere' }]],
		['a project without an id, which the save would create', [{ name: 'New project' }]],
		['projects stated as something other than a list', { id: UNASSIGNED }]
	])('refuses %s with 403', async (_label, projects) => {
		await expect(toCreateOnlyContactInput(input({ projects }), findProjects)).rejects.toBeInstanceOf(
			ForbiddenException
		);
	});

	it('accepts an empty project list without a lookup', async () => {
		await expect(toCreateOnlyContactInput(input({ projects: [] }), findProjects)).resolves.toEqual(
			expect.objectContaining({ projects: [] })
		);
		expect(findProjects).not.toHaveBeenCalled();
	});
});

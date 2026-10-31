import { ForbiddenException } from '@nestjs/common';
import { ID, IOrganizationContactCreateInput, IOrganizationProject } from '@gauzy/contracts';

/**
 * The relations through which saving a contact re-points rows that already exist: TypeORM writes the new
 * contact's id into each row a one-to-many list names.
 */
const EXISTING_ROW_RELATIONS = ['invoices', 'payments', 'expenses', 'incomes', 'timeLogs'] as const;

/** Reads the projects of the new contact's organization that `ids` name. */
export type FindContactProjects = (ids: ID[]) => Promise<Pick<IOrganizationProject, 'id' | 'organizationContactId'>[]>;

/**
 * A contact-create input kept to a create, for a caller who may create contacts but not edit them.
 *
 * `POST /organization-contact` saves the body as it comes: an `id` updates that contact, `contact.id` /
 * `contactId` rewrites or shares another contact's details, and the one-to-many lists move existing projects,
 * invoices, payments, expenses, incomes and time logs onto the new contact. Each of those changes a record that
 * already exists, which is editing, so for this caller:
 *
 * - an existing contact or existing contact details are refused;
 * - existing invoices, payments, expenses, incomes and time logs are refused;
 * - projects may be named only by id, only when they are projects of the organization that have no contact yet,
 *   and only the link is written: nothing else the body says about a project is saved.
 *
 * Everything else — the contact's own fields, its members, tags and new contact details — is created as for any
 * caller.
 *
 * @throws {ForbiddenException} When the input reaches a record that already exists.
 */
export async function toCreateOnlyContactInput(
	input: IOrganizationContactCreateInput,
	findProjects: FindContactProjects
): Promise<IOrganizationContactCreateInput> {
	const refuse = (what: string): never => {
		throw new ForbiddenException(`Creating a contact without permission to edit contacts cannot ${what}.`);
	};
	const { id } = input as { id?: ID };

	if (id) {
		refuse('name an existing contact');
	}
	if (input.contactId || input.contact?.id) {
		refuse('reuse existing contact details');
	}
	for (const relation of EXISTING_ROW_RELATIONS) {
		const rows = (input as unknown as Record<string, unknown>)[relation];
		if (rows != null && (!Array.isArray(rows) || rows.length > 0)) {
			refuse(`attach existing ${relation}`);
		}
	}

	if (input.projects == null) {
		return input;
	}
	if (!Array.isArray(input.projects)) {
		return refuse('attach projects stated that way');
	}

	const ids = [...new Set(input.projects.map((project) => project?.id))];
	if (ids.some((projectId) => typeof projectId !== 'string' || !projectId)) {
		refuse('create projects with it: create them first');
	}
	const found = ids.length ? await findProjects(ids as ID[]) : [];
	if (found.length !== ids.length || found.some((project) => project.organizationContactId)) {
		refuse('take over projects that are not unassigned projects of the organization');
	}

	return { ...input, projects: ids.map((projectId) => ({ id: projectId }) as IOrganizationProject) };
}

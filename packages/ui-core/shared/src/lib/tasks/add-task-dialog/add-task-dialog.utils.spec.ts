import type { IOrganizationProject } from '@gauzy/contracts';
import { isProjectOfClient } from './add-task-dialog.utils';

const ACME = 'client-acme';
const GLOBEX = 'client-globex';

const project = (organizationContactId?: string | null): Partial<IOrganizationProject> => ({
	id: 'project-1',
	name: 'Website',
	organizationContactId
});

describe('isProjectOfClient — narrowing the Add task dialog to a client', () => {
	it.each([
		['no client is picked', null],
		['the client is cleared', undefined],
		['the client is an empty string', '']
	])('keeps any project when %s', (_case, client) => {
		expect(isProjectOfClient(project(GLOBEX), client)).toBe(true);
		expect(isProjectOfClient(project(null), client)).toBe(true);
	});

	it('keeps a project of the picked client', () => {
		expect(isProjectOfClient(project(ACME), ACME)).toBe(true);
	});

	it('drops a project of another client', () => {
		expect(isProjectOfClient(project(GLOBEX), ACME)).toBe(false);
	});

	it('drops a project of no client, which the narrowed list no longer shows', () => {
		expect(isProjectOfClient(project(null), ACME)).toBe(false);
		expect(isProjectOfClient(project(undefined), ACME)).toBe(false);
	});

	it('reads the client off the loaded relation when the row carries no id', () => {
		const withRelation = { organizationContact: { id: ACME } } as unknown as Partial<IOrganizationProject>;

		expect(isProjectOfClient(withRelation, ACME)).toBe(true);
		expect(isProjectOfClient(withRelation, GLOBEX)).toBe(false);
	});

	it('has nothing to drop while no project is selected', () => {
		expect(isProjectOfClient(null, ACME)).toBe(true);
		expect(isProjectOfClient(undefined, ACME)).toBe(true);
	});
});

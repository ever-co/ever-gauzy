import { In } from 'typeorm';
import { archivedStates, withArchivedScope } from './archived-scope';

/**
 * An archived project or team is offered by no list unless the caller asks for archived rows. The `isArchived`
 * a caller states arrives as a boolean (GraphQL, a service), as text (a REST query string), or as a list of
 * either (the Projects and Teams pages' "Include Archived").
 */
describe('archivedStates', () => {
	it('reads the rows that are not archived when the caller states nothing', () => {
		expect(archivedStates(undefined)).toEqual([false]);
		expect(archivedStates(null)).toEqual([false]);
		expect(archivedStates('')).toEqual([false]);
	});

	it('reads the state the caller states, as a boolean or as query-string text', () => {
		expect(archivedStates(true)).toEqual([true]);
		expect(archivedStates('true')).toEqual([true]);
		expect(archivedStates(false)).toEqual([false]);
		expect(archivedStates('false')).toEqual([false]);
	});

	it('reads both states for "Include Archived", once each', () => {
		expect(archivedStates([false, true])).toEqual([false, true]);
		expect(archivedStates(['false', 'true', true])).toEqual([false, true]);
	});

	it('never reads nothing', () => {
		expect(archivedStates([])).toEqual([false]);
	});
});

describe('withArchivedScope', () => {
	it('adds the default to the caller’s `where` without changing it', () => {
		const where = { organizationId: 'organization-1' };

		expect(withArchivedScope(where)).toEqual({ organizationId: 'organization-1', isArchived: false });
		expect(where).toEqual({ organizationId: 'organization-1' });
	});

	it('scopes a read with no `where` at all', () => {
		expect(withArchivedScope(undefined)).toEqual({ isArchived: false });
	});

	it('reads the stated state, or `In` both', () => {
		expect(withArchivedScope({ isArchived: 'true' })).toEqual({ isArchived: true });
		expect(withArchivedScope({ isArchived: [false, true] })).toEqual({ isArchived: In([false, true]) });
	});
});

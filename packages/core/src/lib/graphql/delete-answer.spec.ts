import { deleteRemovedRows } from './delete-answer';

describe('deleteRemovedRows — the answer a GraphQL delete field gives', () => {
	it('answers false for a delete that matched no row: an identifier that names no row of the caller', () => {
		// What `TenantAwareCrudService.delete` answers for a missing row on TypeORM, and on MikroORM.
		expect(deleteRemovedRows({ raw: [], affected: 0 })).toBe(false);
		expect(deleteRemovedRows({ affected: 0 })).toBe(false);
		expect(deleteRemovedRows(0)).toBe(false);
	});

	it('answers true for a delete that removed a row', () => {
		expect(deleteRemovedRows({ raw: [], affected: 1 })).toBe(true);
		expect(deleteRemovedRows({ affected: 3 })).toBe(true);
		expect(deleteRemovedRows(1)).toBe(true);
	});

	it('reads a result that carries no count as a removal: the service answered the row, or nothing, and did not raise', () => {
		expect(deleteRemovedRows(undefined)).toBe(true);
		expect(deleteRemovedRows(null)).toBe(true);
		expect(deleteRemovedRows({ id: 'x', status: 'INACTIVE' })).toBe(true);
	});

	it('does not read an unreported count as "nothing removed"', () => {
		expect(deleteRemovedRows({ raw: [], affected: undefined })).toBe(true);
		expect(deleteRemovedRows({ raw: [], affected: null })).toBe(true);
	});
});

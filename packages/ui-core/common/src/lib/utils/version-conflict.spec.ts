import { HttpErrorResponse } from '@angular/common/http';
import { ENTITY_VERSION_CONFLICT, isEntityVersionConflict } from './version-conflict';

/**
 * A write based on a row that has moved on is answered `409` with the catalogued code `ENTITY_VERSION_CONFLICT`
 * (the equipment sharing edit, ever-co/ever-gauzy#11384). The pages tell that apart from every other failure, so it
 * is pinned on the shapes the HTTP client rejects with.
 */
describe('isEntityVersionConflict', () => {
	const conflict = (body: unknown, status = 409) =>
		new HttpErrorResponse({ status, error: body, url: '/api/equipment-sharing/1' });

	it('is true for a 409 carrying the version-conflict code', () => {
		expect(
			isEntityVersionConflict(
				conflict({
					statusCode: 409,
					error: 'Conflict',
					message: 'The equipment sharing changed since you read it. Read it again and reapply your change.',
					code: ENTITY_VERSION_CONFLICT,
					details: { id: '1', expectedVersion: 2, actualVersion: 3 }
				})
			)
		).toBe(true);
	});

	it('is false for another 409: a request already decided is a refusal of its own', () => {
		const decided = conflict({ statusCode: 409, message: 'Request time off is Conflict' });

		expect(isEntityVersionConflict(decided)).toBe(false);
		expect(isEntityVersionConflict(conflict({ code: 'CONFLICT' }))).toBe(false);
	});

	it('is false for the same code under another status', () => {
		expect(isEntityVersionConflict(conflict({ code: ENTITY_VERSION_CONFLICT }, 400))).toBe(false);
	});

	it('is false for anything that is not an HTTP failure', () => {
		const values = [undefined, null, 'error', new Error('offline'), { status: 409 }, { status: 409, error: null }];

		for (const value of values) {
			expect(isEntityVersionConflict(value)).toBe(false);
		}
	});
});

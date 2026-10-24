import { ApiException } from '../core/errors/api-exception';
import { affectedRows, expectedSharingVersion, sharingVersionConflict } from './sharing-version.helper';

/**
 * The version an equipment-sharing edit is a compare-and-set on, and the refusal it answers when the row moved on.
 */
describe('expectedSharingVersion', () => {
	it('is the version the body states, as a number or as the text a raw body carries', () => {
		expect(expectedSharingVersion(3, 7)).toBe(3);
		expect(expectedSharingVersion('3', 7)).toBe(3);
		expect(expectedSharingVersion(' 3 ', 7)).toBe(3);
	});

	it.each([undefined, null, ''])('is the version the server read when the body states none (%p)', (stated) => {
		expect(expectedSharingVersion(stated, 7)).toBe(7);
	});

	it('is none for a stored row without a version, so the write is made as before', () => {
		expect(expectedSharingVersion(undefined, null)).toBeNull();
		expect(expectedSharingVersion(undefined, undefined)).toBeNull();
	});

	it.each([0, -1, 1.5, 'three', '3a', '-3', true, { $gt: 0 }, [3]])(
		'refuses a stated value that is not a version (%p) with 400',
		(stated) => {
			let error: unknown;
			try {
				expectedSharingVersion(stated, 7);
			} catch (thrown) {
				error = thrown;
			}

			expect(error).toBeInstanceOf(ApiException);
			expect((error as ApiException).getStatus()).toBe(400);
			expect((error as ApiException).code).toBe('VALIDATION_FAILED');
		}
	);
});

describe('sharingVersionConflict', () => {
	it('is a 409 ENTITY_VERSION_CONFLICT naming both versions', () => {
		const conflict = sharingVersionConflict('sharing-1', 2, 3);

		expect(conflict.getStatus()).toBe(409);
		expect(conflict.code).toBe('ENTITY_VERSION_CONFLICT');
		expect(conflict.details).toEqual({ id: 'sharing-1', expectedVersion: 2, actualVersion: 3 });
	});

	it('leaves out a version it does not know', () => {
		expect(sharingVersionConflict('sharing-1', 2, null).details).toEqual({ id: 'sharing-1', expectedVersion: 2 });
		expect(sharingVersionConflict('sharing-1', null).details).toEqual({ id: 'sharing-1' });
	});
});

describe('affectedRows', () => {
	it('reads the affected count either ORM answers, and anything else as none', () => {
		expect(affectedRows({ affected: 1, raw: [] })).toBe(1);
		expect(affectedRows({ affected: 0 })).toBe(0);
		expect(affectedRows({ raw: [] })).toBe(0);
		expect(affectedRows(undefined)).toBe(0);
	});
});

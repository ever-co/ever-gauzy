import { BadRequestException } from '@nestjs/common';
import { updateChanges } from './update-input';

/**
 * The two arguments an update mutation of this package takes (review R2-G41): the older create-shaped
 * `input`, which keeps working, and the partial `patch`.
 */
describe('updateChanges — the older input or the partial patch, never both', () => {
	it('answers the patch when only the patch is stated', () => {
		expect(updateChanges(undefined, { threshold: 4 })).toEqual({ threshold: 4 });
		expect(updateChanges(null, { threshold: 4 })).toEqual({ threshold: 4 });
	});

	it('answers the older input when only the input is stated, so an existing client is answered the same', () => {
		expect(updateChanges({ variantId: 'v', threshold: 4 }, undefined)).toEqual({ variantId: 'v', threshold: 4 });
	});

	it('refuses both, and neither', () => {
		expect(() => updateChanges({ threshold: 4 }, { threshold: 5 })).toThrow(/UPDATE_INPUT_AMBIGUOUS/);
		expect(() => updateChanges(undefined, undefined)).toThrow(BadRequestException);
		expect(() => updateChanges(null, null)).toThrow(/UPDATE_INPUT_REQUIRED/);
	});
});

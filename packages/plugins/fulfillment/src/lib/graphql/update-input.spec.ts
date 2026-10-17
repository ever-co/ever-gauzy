import { BadRequestException } from '@nestjs/common';
import { updateChanges, withoutRequestMembers } from './update-input';

/**
 * The two arguments `updateShippingProfile` / `updateShippingOption` take (review R2-G41): the older
 * create-shaped `input`, which keeps working, and the partial `patch` — and the request-only member a create
 * input carries, which an edit never writes.
 */
describe('updateChanges / withoutRequestMembers — the edit of a shipping profile or option', () => {
	it('answers the patch, or the older input, and refuses both or neither', () => {
		expect(updateChanges(undefined, { name: 'Express' })).toEqual({ name: 'Express' });
		expect(updateChanges({ name: 'Express', code: 'EXP' }, null)).toEqual({ name: 'Express', code: 'EXP' });
		expect(() => updateChanges({ name: 'A' }, { name: 'B' })).toThrow(/UPDATE_INPUT_AMBIGUOUS/);
		expect(() => updateChanges(undefined, undefined)).toThrow(BadRequestException);
	});

	it('drops the create’s retry key, which is no column of the row', () => {
		expect(withoutRequestMembers({ name: 'Express', idempotencyKey: 'key-1' })).toEqual({ name: 'Express' });
		expect(withoutRequestMembers({ code: 'EXP' })).toEqual({ code: 'EXP' });
	});
});

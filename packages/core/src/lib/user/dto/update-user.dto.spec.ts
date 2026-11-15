import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { TimeFormatEnum } from '@gauzy/contracts';
import { UpdateUserDTO } from './update-user.dto';

/**
 * `PUT /user/:id` runs `@UseValidationPipe({ transform: true, whitelist: true })`, so any property the
 * DTO does not declare is stripped from the body before it reaches `UserService.updateProfile`.
 *
 * `imageId` was not declared, which silently broke avatar upload for every client: Ever Teams uploads
 * the file (an ImageAsset is created), then calls `PUT /user/:id` with `{ imageId }` to attach it — the
 * property was dropped, the route still answered `202 Accepted`, and the avatar never changed. The same
 * applied to clearing an avatar with `{ imageId: null }`.
 */

const VALID_IMAGE_ID = '00000000-0000-4000-8000-000000000001';

async function validatePayload(
	payload: Record<string, unknown>
): Promise<{ dto: UpdateUserDTO; errors: ValidationError[] }> {
	const dto = plainToInstance(UpdateUserDTO, payload);
	const errors = await validate(dto, { whitelist: true });

	return { dto, errors };
}

describe('UpdateUserDTO', () => {
	it('keeps imageId so an uploaded avatar can be attached', async () => {
		const { dto, errors } = await validatePayload({ imageId: VALID_IMAGE_ID });

		expect(errors).toHaveLength(0);
		expect(dto.imageId).toBe(VALID_IMAGE_ID);
	});

	it('keeps a null imageId so an avatar can be cleared', async () => {
		const { dto, errors } = await validatePayload({ imageId: null });

		expect(errors).toHaveLength(0);
		expect(dto.imageId).toBeNull();
	});

	it('rejects an imageId that is not a UUID', async () => {
		const { errors } = await validatePayload({ imageId: 'not-a-uuid' });

		expect(errors.some((error) => error.property === 'imageId')).toBe(true);
	});

	// The Ever Teams time zone picker sends `{ timeZone }` alone; the employee settings of the Angular app send
	// `{ timeZone, timeFormat }` together. Both were stripped, the route still answered `202 Accepted`.
	it('keeps timeZone so a time zone picked in the profile is saved', async () => {
		const { dto, errors } = await validatePayload({ timeZone: 'America/New_York' });

		expect(errors).toHaveLength(0);
		expect((dto as Record<string, unknown>).timeZone).toBe('America/New_York');
	});

	it('rejects a timeZone that is not a string', async () => {
		const { errors } = await validatePayload({ timeZone: 42 });

		expect(errors.some((error) => error.property === 'timeZone')).toBe(true);
	});

	it('keeps timeFormat so the clock chosen with the time zone is saved', async () => {
		const { dto, errors } = await validatePayload({
			timeZone: 'Africa/Kinshasa',
			timeFormat: TimeFormatEnum.FORMAT_24_HOURS
		});

		expect(errors).toHaveLength(0);
		expect((dto as Record<string, unknown>).timeFormat).toBe(TimeFormatEnum.FORMAT_24_HOURS);
	});

	it('rejects a timeFormat outside the 12 and 24 hour clocks', async () => {
		const { errors } = await validatePayload({ timeFormat: 13 });

		expect(errors.some((error) => error.property === 'timeFormat')).toBe(true);
	});

	// Control: proves `whitelist: true` is genuinely in force in this test, so the assertions above
	// cannot pass merely because nothing is being stripped.
	it('still strips a property the DTO does not declare', async () => {
		const { dto } = await validatePayload({ emailVerifiedAt: '2026-01-01T00:00:00.000Z' });

		expect((dto as Record<string, unknown>).emailVerifiedAt).toBeUndefined();
	});
});

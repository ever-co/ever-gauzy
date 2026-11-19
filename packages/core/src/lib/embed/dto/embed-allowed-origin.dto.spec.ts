// Must stay first: loads the entity graph before the DTO pulls an entity (see user.create.handler.spec.ts).
import '../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEmbedAllowedOriginDTO, UpdateEmbedAllowedOriginDTO } from './embed-allowed-origin.dto';

/**
 * The allowed-origin routes run a whitelisting validation pipe: a field the DTO does not declare is dropped without a
 * word, so a site asked to let people sign in would be stored, or left, with sign-in off.
 */
describe('allowPersonSignIn through the allowed-origin DTOs', () => {
	/** The errors of the setting alone (no organization is named on creation, so its membership check never runs). */
	const errorsOf = async <T extends object>(type: new () => T, body: Record<string, unknown>) => {
		const dto = plainToInstance(type, body);
		const errors = await validate(dto, { whitelist: true });
		return { dto, errors: errors.filter((error) => error.property === 'allowPersonSignIn') };
	};

	it('keeps the setting through the whitelist, on or off, on creation and on change', async () => {
		for (const allowPersonSignIn of [true, false]) {
			const created = await errorsOf(CreateEmbedAllowedOriginDTO, {
				origin: 'https://team.example.com',
				allowPersonSignIn
			});
			const changed = await errorsOf(UpdateEmbedAllowedOriginDTO, { allowPersonSignIn });

			expect(created.errors).toEqual([]);
			expect(created.dto.allowPersonSignIn).toBe(allowPersonSignIn);
			expect(changed.errors).toEqual([]);
			expect(changed.dto.allowPersonSignIn).toBe(allowPersonSignIn);
		}
	});

	it('takes a creation without the setting, and refuses a change without it', async () => {
		const created = await errorsOf(CreateEmbedAllowedOriginDTO, { origin: 'https://team.example.com' });
		const changed = await errorsOf(UpdateEmbedAllowedOriginDTO, {});

		expect(created.errors).toEqual([]);
		expect(created.dto.allowPersonSignIn).toBeUndefined();
		expect(changed.errors).toHaveLength(1);
	});

	it('refuses a setting that is not a boolean', async () => {
		for (const allowPersonSignIn of ['true', 1, 'yes']) {
			const created = await errorsOf(CreateEmbedAllowedOriginDTO, {
				origin: 'https://team.example.com',
				allowPersonSignIn
			});
			const changed = await errorsOf(UpdateEmbedAllowedOriginDTO, { allowPersonSignIn });

			expect(created.errors[0].constraints).toHaveProperty('isBoolean');
			expect(changed.errors[0].constraints).toHaveProperty('isBoolean');
		}
	});
});

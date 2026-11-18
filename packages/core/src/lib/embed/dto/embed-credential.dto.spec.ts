// Must stay first: loads the entity graph before the DTO pulls an entity (see user.create.handler.spec.ts).
import '../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateEmbedCredentialDTO } from './embed-credential.dto';

/**
 * `POST /api/embed-credentials` runs a whitelisting validation pipe: a field the DTO does not declare is dropped
 * without a word, so a credential asked to add members would be created without the option.
 */
describe('CreateEmbedCredentialDTO: canAddMembers', () => {
	/** The errors of the option alone (no organization is named, so its membership check never runs). */
	const errorsOf = async (body: Record<string, unknown>) => {
		const dto = plainToInstance(CreateEmbedCredentialDTO, { name: 'Fabrikam portal', ...body });
		const errors = await validate(dto, { whitelist: true });
		return { dto, errors: errors.filter((error) => error.property === 'canAddMembers') };
	};

	it('keeps the option through the whitelist, on or off', async () => {
		for (const canAddMembers of [true, false]) {
			const { dto, errors } = await errorsOf({ canAddMembers });

			expect(errors).toEqual([]);
			expect(dto.canAddMembers).toBe(canAddMembers);
		}
	});

	it('takes a body without the option', async () => {
		const { dto, errors } = await errorsOf({});

		expect(errors).toEqual([]);
		expect(dto.canAddMembers).toBeUndefined();
	});

	it('refuses an option that is not a boolean', async () => {
		for (const canAddMembers of ['true', 1, 'yes']) {
			const { errors } = await errorsOf({ canAddMembers });

			expect(errors).toHaveLength(1);
			expect(errors[0].constraints).toHaveProperty('isBoolean');
		}
	});
});

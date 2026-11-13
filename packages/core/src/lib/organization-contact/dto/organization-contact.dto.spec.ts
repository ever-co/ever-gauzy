/**
 * 🛑 This import must stay FIRST, before any import that pulls a core entity — see `channel.controller.spec.ts`
 * for the cycle it avoids.
 */
import '../../core/entities/internal';

import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ContactType } from '@gauzy/contracts';
import { CreateOrganizationContactDTO } from './create-organization-contact.dto';
import { UpdateOrganizationContactDTO } from './update-organization-contact.dto';

/**
 * A client's payment terms set when its invoices fall due. The REST create and update routes run their DTO under
 * `whitelist: true`, so a field the DTO does not declare is dropped without a word: the terms must be declared to be
 * written at all, and only as a whole number of days, zero for due on receipt.
 */
describe('Organization contact REST DTOs — payment terms', () => {
	// As `OrganizationContactController.create` and `update` run it.
	const pipe = new ValidationPipe({ whitelist: true });
	const body = {
		name: 'Acme',
		contactType: ContactType.CLIENT,
		// Stands in for the organization, whose membership check needs a repository (as in `comment.dto.spec.ts`).
		sentTo: 'organization-of-contact'
	};
	const dtos = [
		['CreateOrganizationContactDTO', CreateOrganizationContactDTO],
		['UpdateOrganizationContactDTO', UpdateOrganizationContactDTO]
	] as const;

	it.each(dtos)("%s keeps a client's payment terms", async (_name, metatype) => {
		const value = await pipe.transform({ ...body, paymentTermsDays: 30 }, { type: 'body', metatype, data: '' });

		expect(value).toEqual(expect.objectContaining({ name: 'Acme', paymentTermsDays: 30 }));
	});

	it.each(dtos)('%s keeps zero, due on receipt', async (_name, metatype) => {
		const value = await pipe.transform({ ...body, paymentTermsDays: 0 }, { type: 'body', metatype, data: '' });

		expect(value).toEqual(expect.objectContaining({ paymentTermsDays: 0 }));
	});

	it.each(dtos)('%s refuses terms that are not a whole number of days from zero', async (_name, metatype) => {
		for (const paymentTermsDays of [-1, 2.5, '30']) {
			await expect(
				pipe.transform({ ...body, paymentTermsDays }, { type: 'body', metatype, data: '' })
			).rejects.toBeInstanceOf(BadRequestException);
		}
	});
});

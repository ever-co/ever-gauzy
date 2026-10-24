/**
 * 🛑 This import must stay FIRST: the DTOs below pick members of entities, and the entity graph has to finish
 * initializing before they do.
 */
import '../../core/entities/internal';

import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { getMetadataStorage } from 'class-validator';
import { UpdateCandidateDTO } from '../../candidate/dto/update-candidate.dto';
import { ProfileContactDTO } from './profile-contact.dto';
import { UpdateEmployeeDTO } from './update-employee.dto';
import { UpdateProfileDTO } from './update-profile.dto';

/**
 * `UpdateProfileDTO.contact` was a bare `@IsObject()`, so `whitelist` never reached inside it, and the nested `id`
 * (and anything else) reached the cascading save (privilege-escalation audit 2026-10-24, F9). It is now validated
 * as a `ProfileContactDTO`, on every DTO built from it.
 */
describe('ProfileContactDTO — the contact a profile edit may send', () => {
	const pipe = new ValidationPipe({ whitelist: true, transform: true });
	const run = (value: unknown) => pipe.transform(value, { type: 'body', metatype: ProfileContactDTO } as never);

	it('keeps what the profile location form sends', async () => {
		const result = await run({
			country: 'BG',
			city: 'Sofia',
			address: 'Main 1',
			postcode: '1000',
			latitude: 42.7,
			longitude: 23.3
		});

		expect({ ...result }).toEqual({
			country: 'BG',
			city: 'Sofia',
			address: 'Main 1',
			postcode: '1000',
			latitude: 42.7,
			longitude: 23.3
		});
	});

	it('strips the scope and the other owners of a contact row', async () => {
		const result = await run({
			id: '99999999-9999-4999-8999-999999999999',
			city: 'Sofia',
			tenantId: '11111111-1111-4111-8111-111111111111',
			organizationId: '22222222-2222-4222-8222-222222222222',
			organizationContact: { id: 'client-1' },
			candidate: { id: 'candidate-1' },
			employee: { id: 'employee-1' }
		});

		// The id is accepted as data and filtered by the handler (ownContactPatch): only the profile's own survives.
		expect({ ...result }).toEqual({ id: '99999999-9999-4999-8999-999999999999', city: 'Sofia' });
	});

	it('refuses a contact id that is not a UUID', async () => {
		await expect(run({ id: 'not-a-uuid', city: 'Sofia' })).rejects.toBeDefined();
	});

	it.each([
		['UpdateProfileDTO', UpdateProfileDTO],
		['UpdateEmployeeDTO', UpdateEmployeeDTO],
		['UpdateCandidateDTO', UpdateCandidateDTO]
	])('%s validates its contact as a ProfileContactDTO', (_name, dto) => {
		const nested = getMetadataStorage()
			.getTargetValidationMetadatas(dto as never, undefined as never, false, false)
			.filter((metadata) => metadata.propertyName === 'contact' && metadata.type === 'nestedValidation');
		expect(nested.length).toBeGreaterThan(0);

		const instance = plainToInstance(dto as never, { contact: { city: 'Sofia' } }) as { contact: unknown };
		expect(instance.contact).toBeInstanceOf(ProfileContactDTO);
	});
});

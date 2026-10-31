import {
	currentContactId,
	linkedContactCountry,
	organizationLocations,
	storedOrganizationLocation
} from './organization-location';
import { MultiORMEnum } from '../core/utils';

/**
 * Where an organization is for the EEA/UK rules (#9872 screen capture, #9873 agent exit/logout): judged from what
 * is stored and what the write stores, never from a top-level `country` the organization does not store.
 */
const lookup = (result: unknown) => ({ findOneOrFailByIdString: jest.fn().mockResolvedValue(result) });

afterEach(() => jest.restoreAllMocks());

describe('linkedContactCountry', () => {
	it('reads the country of a contact other than the current one', async () => {
		const contacts = lookup({ success: true, record: { country: 'GB' } });

		await expect(linkedContactCountry(contacts, 'contact-uk', 'contact-us')).resolves.toBe('GB');
		expect(contacts.findOneOrFailByIdString).toHaveBeenCalledWith('contact-uk');
	});

	it('reads nothing without a contact, for the current contact, or without a lookup', async () => {
		const contacts = lookup({ success: true, record: { country: 'GB' } });

		await expect(linkedContactCountry(contacts, undefined, 'contact-us')).resolves.toBeUndefined();
		await expect(linkedContactCountry(contacts, 'contact-us', 'contact-us')).resolves.toBeUndefined();
		await expect(linkedContactCountry(undefined, 'contact-uk')).resolves.toBeUndefined();
		expect(contacts.findOneOrFailByIdString).not.toHaveBeenCalled();
	});

	it('answers undefined for a contact that is not found or has no country', async () => {
		await expect(linkedContactCountry(lookup({ success: false }), 'contact-x')).resolves.toBeUndefined();
		await expect(
			linkedContactCountry(lookup({ success: true, record: { country: null } }), 'contact-x')
		).resolves.toBeUndefined();
	});
});

describe('currentContactId', () => {
	it('reads the column first, then the loaded relation', () => {
		expect(currentContactId({ contactId: 'contact-a', contact: { id: 'contact-b' } })).toBe('contact-a');
		expect(currentContactId({ contact: { id: 'contact-b' } })).toBe('contact-b');
	});

	it('answers undefined for an organization without a contact, or none at all', () => {
		expect(currentContactId({ contactId: null, contact: null })).toBeUndefined();
		expect(currentContactId(undefined)).toBeUndefined();
	});
});

describe('storedOrganizationLocation', () => {
	it('reads the region code, the time zone and the country of the loaded contact', () => {
		expect(
			storedOrganizationLocation({ regionCode: 'en', timeZone: 'Europe/London', contact: { country: 'GB' } })
		).toEqual({ regionCode: 'en', timeZone: 'Europe/London', country: 'GB' });
	});

	it('answers an empty location for an organization without a contact, or none at all', () => {
		expect(storedOrganizationLocation({ regionCode: undefined, timeZone: undefined, contact: null })).toEqual({
			regionCode: undefined,
			timeZone: undefined,
			country: undefined
		});
		expect(storedOrganizationLocation(undefined)).toEqual({
			regionCode: undefined,
			timeZone: undefined,
			country: undefined
		});
	});
});

describe('organizationLocations', () => {
	const STORED = {
		regionCode: 'en',
		timeZone: 'America/New_York',
		contactId: 'contact-us',
		contact: { id: 'contact-us', country: 'US' }
	};
	const UK_CONTACT = { success: true, record: { country: 'GB' } };

	it('answers the stored location, the location after the write and the values the request names', async () => {
		const { stored, after, requested } = await organizationLocations(
			STORED,
			{ timeZone: 'Europe/Berlin', contact: { id: 'contact-uk', country: 'FR' } as never },
			lookup(UK_CONTACT),
			MultiORMEnum.TypeORM
		);

		expect(stored).toEqual({ regionCode: 'en', timeZone: 'America/New_York', country: 'US' });
		// The linked contact counts with the country it has; the carried `country` is not stored.
		expect(after).toEqual({ regionCode: 'en', timeZone: 'Europe/Berlin', country: 'GB' });
		expect(requested).toEqual([
			{ regionCode: undefined, timeZone: 'Europe/Berlin', country: 'FR' },
			{ country: 'GB' }
		]);
	});

	it('moves nothing for a top-level country or the country of a contact the request carries', async () => {
		const { after, requested } = await organizationLocations(
			STORED,
			{ country: 'DE', contact: { country: 'DE' } } as never,
			lookup(UK_CONTACT)
		);

		expect(after).toEqual({ regionCode: 'en', timeZone: 'America/New_York', country: 'US' });
		// The carried country is only a requested value; the top-level one is not even that.
		expect(requested).toEqual([
			{ regionCode: undefined, timeZone: undefined, country: 'DE' },
			{ country: undefined }
		]);
	});

	it.each([
		[MultiORMEnum.TypeORM, 'GB'],
		[MultiORMEnum.MikroORM, 'US']
	])(
		'counts a contact linked by the contactId column only where the save stores it (%s)',
		async (ormType, country) => {
			const { after, requested } = await organizationLocations(
				STORED,
				{ contactId: 'contact-uk' },
				lookup(UK_CONTACT),
				ormType
			);

			expect(after.country).toBe(country);
			expect(requested).toContainEqual({ country: 'GB' });
		}
	);

	it('keeps the stored country when the contact a write links cannot be read', async () => {
		const { after } = await organizationLocations(
			STORED,
			{ contact: { id: 'contact-x' } as never },
			lookup({ success: false })
		);

		expect(after.country).toBe('US');
	});

	it('takes the region code and time zone the write sets, including a cleared one', async () => {
		const { after } = await organizationLocations(
			{ ...STORED, timeZone: 'Europe/Berlin' },
			{ regionCode: 'en-IE', timeZone: null as never },
			lookup({ success: false })
		);

		expect(after).toMatchObject({ regionCode: 'en-IE', timeZone: null });
	});

	it('reads a linked contact once, and none when the write links the current one or none', async () => {
		const contacts = lookup(UK_CONTACT);

		await organizationLocations(STORED, { contactId: 'contact-uk' }, contacts);
		expect(contacts.findOneOrFailByIdString).toHaveBeenCalledTimes(1);

		await organizationLocations(STORED, { contactId: 'contact-us' }, contacts);
		await organizationLocations(STORED, { name: 'Renamed' } as never, contacts);
		expect(contacts.findOneOrFailByIdString).toHaveBeenCalledTimes(1);
	});
});

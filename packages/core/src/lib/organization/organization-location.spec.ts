import {
	currentContactId,
	linkedContactCountry,
	organizationLocations,
	storedOrganizationLocation
} from './organization-location';

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

	it('answers the stored location, and after the write the stored one plus what the write stores', async () => {
		const contacts = lookup({ success: true, record: { country: 'GB' } });

		const { stored, after } = await organizationLocations(
			STORED,
			{ timeZone: 'Europe/Berlin', contact: { id: 'contact-uk', country: 'FR' } as never },
			contacts
		);

		expect(stored).toEqual({ regionCode: 'en', timeZone: 'America/New_York', country: 'US' });
		expect(after).toEqual([
			stored,
			{ regionCode: undefined, timeZone: 'Europe/Berlin', country: 'FR' },
			{ country: 'GB' }
		]);
	});

	it('leaves out a top-level country, which the organization does not store', async () => {
		const { after } = await organizationLocations(STORED, { country: 'DE' } as never, lookup({ success: false }));

		expect(after.some((location) => location.country === 'DE')).toBe(false);
	});

	it('reads a contact linked by contactId, and none when the write links the current one or none', async () => {
		const contacts = lookup({ success: true, record: { country: 'GB' } });

		await expect(organizationLocations(STORED, { contactId: 'contact-uk' }, contacts)).resolves.toMatchObject({
			after: [expect.anything(), expect.anything(), { country: 'GB' }]
		});
		expect(contacts.findOneOrFailByIdString).toHaveBeenCalledTimes(1);

		await organizationLocations(STORED, { contactId: 'contact-us' }, contacts);
		await organizationLocations(STORED, { name: 'Renamed' } as never, contacts);
		expect(contacts.findOneOrFailByIdString).toHaveBeenCalledTimes(1);
	});
});

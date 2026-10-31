import { IAgentRestrictionLocation, IContact, ID, IOrganization, IOrganizationUpdateInput } from '@gauzy/contracts';
import { runOutsideOrganizationBoundary } from '../core/crud/organization-boundary';
import type { ITryRequest } from '../core/crud/try-request';

/**
 * Where an organization is, for the rules that depend on the EEA/UK: the screen capture acknowledgement
 * (#9872) and the agent exit/logout restriction (#9873). Both judge the location from what is stored and what
 * the write stores. The organization keeps its region code and time zone as columns and its country on its
 * contact; a top-level `country` in the write is not stored on the organization, so it does not count.
 */

/** What {@link linkedContactCountry} reads contacts with: `ContactService`, tenant-scoped. */
export interface IContactLookup {
	findOneOrFailByIdString(id: ID): Promise<ITryRequest<Pick<IContact, 'country'>>>;
}

/**
 * The contact an organization row links: its `contactId` column (on the entity, not on `IOrganization`) or the
 * loaded relation.
 */
export function currentContactId(
	organization: { contactId?: ID | null; contact?: Pick<IContact, 'id'> | null } | null | undefined
): ID | undefined {
	return organization?.contactId ?? organization?.contact?.id ?? undefined;
}

/**
 * The country of a contact an organization write links by id, when it is not the organization's current contact:
 * the organization will be where that contact is, so its country counts in the EEA/UK check. Read within the
 * tenant, across its organizations (the write itself may link any contact of the tenant).
 *
 * @param contacts the contact lookup; none (e.g. not resolvable) reads nothing
 * @param contactId the contact the write links (`contact.id` or `contactId`)
 * @param currentContactId the organization's current contact, which the stored location already covers
 * @returns the contact's country, or `undefined` when there is no other contact or it cannot be read
 */
export async function linkedContactCountry(
	contacts: IContactLookup | undefined,
	contactId: ID | undefined,
	currentContactId?: ID | null
): Promise<string | undefined> {
	if (!contacts || !contactId || contactId === currentContactId) {
		return undefined;
	}
	const found = await runOutsideOrganizationBoundary(() => contacts.findOneOrFailByIdString(contactId));
	return (found?.success && found.record?.country) || undefined;
}

/** Where an organization row is: its region code, time zone and the country of its (loaded) contact. */
export function storedOrganizationLocation(
	organization:
		| (Pick<IOrganization, 'regionCode' | 'timeZone'> & { contact?: Pick<IContact, 'country'> | null })
		| null
		| undefined
): IAgentRestrictionLocation {
	return {
		regionCode: organization?.regionCode,
		timeZone: organization?.timeZone,
		country: organization?.contact?.country
	};
}

/** An organization's location before and after one update. */
export interface IOrganizationLocations {
	/** Where the organization is as stored: region code, time zone and the country of its contact. */
	stored: IAgentRestrictionLocation;
	/**
	 * Every location the organization may have after the write, for the checks made before the save: the stored
	 * one, plus the values the write stores (region code, time zone, the country of a contact it links by id) and
	 * the country of a contact it carries. The organization counts as EEA/UK after the write if any of them is.
	 *
	 * A carried contact counts although the save may not store it (the relation does not cascade under TypeORM), so
	 * these checks ask or refuse rather than miss a move. An effect that follows a move once saved, such as lifting
	 * the employees' restrictions, reads the saved row instead (see {@link storedOrganizationLocation}).
	 */
	after: IAgentRestrictionLocation[];
}

/**
 * The organization's location before and after an update, judged from what is stored and what the write stores.
 * Reads a contact only when the write links one other than the organization's current contact.
 *
 * @param organization the organization as stored, with its contact loaded
 * @param changes the update as it will be written
 * @param contacts the contact lookup for a contact the write links by id
 */
export async function organizationLocations(
	organization: Pick<IOrganization, 'regionCode' | 'timeZone'> & {
		contactId?: ID | null;
		contact?: Pick<IContact, 'id' | 'country'> | null;
	},
	changes: Pick<IOrganizationUpdateInput, 'regionCode' | 'timeZone' | 'contact'> & { contactId?: ID | null },
	contacts: IContactLookup | undefined
): Promise<IOrganizationLocations> {
	const stored = storedOrganizationLocation(organization);
	const linkedCountry = await linkedContactCountry(
		contacts,
		changes.contact?.id ?? changes.contactId ?? undefined,
		currentContactId(organization)
	);

	return {
		stored,
		after: [
			stored,
			{ regionCode: changes.regionCode, timeZone: changes.timeZone, country: changes.contact?.country },
			{ country: linkedCountry }
		]
	};
}

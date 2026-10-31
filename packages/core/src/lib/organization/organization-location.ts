import { IAgentRestrictionLocation, IContact, ID, IOrganization, IOrganizationUpdateInput } from '@gauzy/contracts';
import { runOutsideOrganizationBoundary } from '../core/crud/organization-boundary';
import type { ITryRequest } from '../core/crud/try-request';
import { getORMType, MultiORM, MultiORMEnum } from '../core/utils';

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
	 * Where the organization is after the write, from what the save stores: the region code and time zone the write
	 * sets (the stored ones otherwise), and the country of the contact the organization is linked to afterwards.
	 */
	after: IAgentRestrictionLocation;
	/**
	 * The location values the request names, whether the save stores them or not: the region code, the time zone,
	 * the country of a contact it carries and the country of a contact it links by id. Only for a check that asks
	 * rather than allows (the screen capture acknowledgement), where counting more can only ask more.
	 */
	requested: IAgentRestrictionLocation[];
}

/**
 * The organization's location before and after an update, judged from what is stored and what the write stores.
 * Reads a contact only when the write links one other than the organization's current contact.
 *
 * What an organization save stores for its contact (the relation does not cascade):
 * - a contact linked by `contact.id`, under both ORMs, with the country that contact has;
 * - a contact linked by the `contactId` column, under TypeORM only (MikroORM does not map the column);
 * - never the fields of a contact the request carries, such as its `country`; and never a top-level `country`.
 * A linked contact whose country cannot be read keeps the stored country, so the result can only be stricter.
 *
 * @param organization the organization as stored, with its contact loaded
 * @param changes the update as it will be written
 * @param contacts the contact lookup for a contact the write links by id
 * @param ormType the ORM the save runs on
 */
export async function organizationLocations(
	organization: Pick<IOrganization, 'regionCode' | 'timeZone'> & {
		contactId?: ID | null;
		contact?: Pick<IContact, 'id' | 'country'> | null;
	},
	changes: Pick<IOrganizationUpdateInput, 'regionCode' | 'timeZone' | 'contact'> & { contactId?: ID | null },
	contacts: IContactLookup | undefined,
	ormType: MultiORM = getORMType()
): Promise<IOrganizationLocations> {
	const stored = storedOrganizationLocation(organization);
	const current = currentContactId(organization);
	const linked = changes.contact?.id ?? changes.contactId ?? undefined;
	const linkedCountry = await linkedContactCountry(contacts, linked, current);
	const savesLink = !!linked && linked !== current && (!!changes.contact?.id || ormType === MultiORMEnum.TypeORM);

	return {
		stored,
		after: {
			regionCode: changes.regionCode !== undefined ? changes.regionCode : stored.regionCode,
			timeZone: changes.timeZone !== undefined ? changes.timeZone : stored.timeZone,
			country: savesLink ? (linkedCountry ?? stored.country) : stored.country
		},
		requested: [
			{ regionCode: changes.regionCode, timeZone: changes.timeZone, country: changes.contact?.country },
			{ country: linkedCountry }
		]
	};
}

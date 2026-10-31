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

/** The contact fields of an organization write: the relation (an object, an id alone or `null`) and the column. */
export type IOrganizationContactChanges = {
	contact?: Pick<IContact, 'id' | 'country'> | ID | null;
	contactId?: ID | null;
};

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
 * Reads a contact's country within the tenant, across its organizations (a write may link any contact of the
 * tenant).
 *
 * @returns whether the contact was read, and its country
 */
async function readContactCountry(
	contacts: IContactLookup | undefined,
	contactId: ID
): Promise<{ read: boolean; country?: string }> {
	if (!contacts) {
		return { read: false };
	}
	const found = await runOutsideOrganizationBoundary(() => contacts.findOneOrFailByIdString(contactId));
	return found?.success ? { read: true, country: found.record?.country || undefined } : { read: false };
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
	if (!contactId || contactId === currentContactId) {
		return undefined;
	}
	return (await readContactCountry(contacts, contactId)).country;
}

/**
 * The contact an organization is linked to after a save of `changes`, from what the save stores (pinned on a real
 * database by `organization-location.persistence.spec.ts`; the relation does not cascade):
 * - `contact: { id }` links that contact, under both ORMs;
 * - `contact: '<id>'` links that contact under MikroORM and clears the link under TypeORM;
 * - `contact: null` clears the link, under both ORMs;
 * - `contactId` is stored under TypeORM only (MikroORM does not map the column): a contact other than the current
 *   one is linked, over `contact: null` or an id alone; `contactId: null` clears the link.
 * A contact without an id keeps the link under TypeORM and clears it under MikroORM: it counts as kept, the stricter
 * of the two (the stored country still counts).
 *
 * @param changes the update as it will be written
 * @param current the organization's current contact
 * @param ormType the ORM the save runs on
 * @returns the contact linked after the save, `null` when the save clears the link, `undefined` when it keeps it
 */
export function savedContactLink(
	changes: IOrganizationContactChanges,
	current: ID | undefined,
	ormType: MultiORM
): ID | null | undefined {
	const { contact, contactId } = changes;
	if (contact && typeof contact === 'object') {
		return contact.id || undefined;
	}
	if (ormType === MultiORMEnum.TypeORM && contactId && contactId !== current) {
		return contactId;
	}
	if (typeof contact === 'string') {
		return ormType === MultiORMEnum.MikroORM && contact ? contact : null;
	}
	if (contact === null) {
		return null;
	}
	return ormType === MultiORMEnum.TypeORM && contactId === null ? null : undefined;
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
	 * sets (the stored ones otherwise), and the country of the contact the organization is linked to afterwards
	 * (none when the save clears the link).
	 */
	after: IAgentRestrictionLocation;
	/**
	 * The location values the request names, whether the save stores them or not: the region code, the time zone,
	 * the country of a contact it carries and the country of each contact it names by id. Only for a check that asks
	 * rather than allows (the screen capture acknowledgement), where counting more can only ask more.
	 */
	requested: IAgentRestrictionLocation[];
	/**
	 * The contact the save links when it cannot be read: the country after the write is then unknown, and `after`
	 * cannot be judged.
	 */
	unreadContactId?: ID;
}

/**
 * The organization's location before and after an update, judged from what is stored and what the write stores
 * (see {@link savedContactLink}). A top-level `country` and the fields of a contact the request carries are never
 * stored. Reads each contact the request names by id, other than the organization's current contact, once.
 *
 * @param organization the organization as stored, with its contact loaded
 * @param changes the update as it will be written
 * @param contacts the contact lookup for a contact the write names by id
 * @param ormType the ORM the save runs on
 */
export async function organizationLocations(
	organization: Pick<IOrganization, 'regionCode' | 'timeZone'> & {
		contactId?: ID | null;
		contact?: Pick<IContact, 'id' | 'country'> | null;
	},
	changes: Pick<IOrganizationUpdateInput, 'regionCode' | 'timeZone'> & IOrganizationContactChanges,
	contacts: IContactLookup | undefined,
	ormType: MultiORM = getORMType()
): Promise<IOrganizationLocations> {
	const stored = storedOrganizationLocation(organization);
	const current = currentContactId(organization);
	const { contact } = changes;
	const carried = contact && typeof contact === 'object' ? contact : undefined;
	const named = [...new Set([typeof contact === 'string' ? contact : carried?.id, changes.contactId])].filter(
		(id): id is ID => !!id && id !== current
	);
	const read = new Map(
		await Promise.all(named.map(async (id) => [id, await readContactCountry(contacts, id)] as const))
	);
	const linked = savedContactLink(changes, current, ormType);
	const linkedRead = linked ? read.get(linked) : undefined;

	return {
		stored,
		after: {
			regionCode: changes.regionCode !== undefined ? changes.regionCode : stored.regionCode,
			timeZone: changes.timeZone !== undefined ? changes.timeZone : stored.timeZone,
			country: linked === undefined || linked === current ? stored.country : linkedRead?.country
		},
		requested: [
			{ regionCode: changes.regionCode, timeZone: changes.timeZone, country: carried?.country },
			...named.map((id) => ({ country: read.get(id)?.country }))
		],
		...(linkedRead && !linkedRead.read && { unreadContactId: linked as ID })
	};
}

import { ID } from '@gauzy/contracts';

/**
 * The Ever ID sign-in links of Gauzy users: `zitadel_account` (issuer + subject ↔ one Gauzy user per tenant), created
 * by the core migration `1790000018000-AuthZitadel` and written by the Ever ID sign-in plugin only after the person
 * proved control of both sides (an e-mail match alone never creates one).
 */
export const EVER_ID_ACCOUNT_TABLE = 'zitadel_account';

/** One Ever ID identity: the subject at its issuer (Ever Works `everIdSubjects`, Gauzy `zitadel_account`). */
export interface EverIdIdentity {
	issuer: string;
	subject: string;
}

/** How a People-tab pairing was made, kept on the link (`ewOnly.matchedBy`). */
export type EverWorksMatchSource = 'ever_id' | 'verified_email' | 'manual';

/**
 * The key an identity is matched on: the exact subject at the issuer, the issuer compared without trailing slashes
 * (Gauzy stores issuers without them; an OIDC issuer may be written either way).
 */
export function everIdKey(identity: EverIdIdentity): string {
	let issuer = (identity.issuer ?? '').trim();
	while (issuer.endsWith('/')) issuer = issuer.slice(0, -1);
	return `${issuer}\n${identity.subject ?? ''}`;
}

/**
 * Ever ID matches (plan 01 §3, step 1): the Ever Works members whose Ever ID identities resolve to exactly one Gauzy
 * person, where no other member resolves to that person. A member whose identities lead to several people, or a
 * person several members lead to, is not matched: the verified e-mail suggestion and the admin decide those.
 *
 * Every member given claims every person it leads to — an ambiguous member and an excluded one too — so a person
 * another member also leads to is never matched with one of them.
 *
 * @param members the unpaired members, with their `everIdSubjects`
 * @param usersByIdentity Gauzy user ids by {@link everIdKey}
 * @param personOfUser the Gauzy person (employee id) of a Gauzy user, for the people that may be paired
 * @param exclude members that claim but are not matched (declined by an admin, deactivated)
 * @returns the person of each matched member, by Ever Works user id
 */
export function everIdMatches(
	members: ReadonlyArray<{ userId: string; everIdSubjects?: ReadonlyArray<EverIdIdentity> | null }>,
	usersByIdentity: ReadonlyMap<string, ReadonlySet<string>>,
	personOfUser: ReadonlyMap<string, ID>,
	exclude: ReadonlySet<string> = new Set()
): Map<string, ID> {
	const peopleOf = new Map<string, Set<ID>>();
	const claims = new Map<ID, number>();
	for (const member of members) {
		const people = new Set<ID>();
		for (const identity of member.everIdSubjects ?? []) {
			for (const userId of usersByIdentity.get(everIdKey(identity)) ?? []) {
				const person = personOfUser.get(userId);
				if (person) people.add(person);
			}
		}
		peopleOf.set(member.userId, people);
		for (const person of people) claims.set(person, (claims.get(person) ?? 0) + 1);
	}
	const matches = new Map<string, ID>();
	for (const [userId, people] of peopleOf) {
		if (exclude.has(userId) || people.size !== 1) continue;
		const [person] = people;
		if (claims.get(person) === 1) matches.set(userId, person);
	}
	return matches;
}

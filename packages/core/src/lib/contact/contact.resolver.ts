import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { IPagination, ID as Id } from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Contact } from './contact.entity';
import { ContactService } from './contact.service';

/** The members `CreateContactInput` declares in the schema. */
export interface ICreateContactInput {
	organizationId?: Id;
	name?: string;
	firstName?: string;
	lastName?: string;
	country?: string;
	city?: string;
	address?: string;
	address2?: string;
	postcode?: string;
	latitude?: number;
	longitude?: number;
	regionCode?: string;
	fax?: string;
	fiscalInformation?: string;
	website?: string;
}

/** The members `UpdateContactInput` declares in the schema. */
export interface IUpdateContactInput extends ICreateContactInput {
	id: Id;
}

/**
 * The fields a contact list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ContactFilter` and `ContactSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `latitude` and `longitude` are in neither. They are coordinates rather than a narrowing — no
 * caller reads a list of parties by where they sit to six decimal places — and the address book's
 * own query schema leaves them out for the same reason.
 */
const CONTACT_FILTERABLE = {
	id: 'ID',
	organizationId: 'ID',
	name: 'STRING',
	firstName: 'STRING',
	lastName: 'STRING',
	country: 'STRING',
	city: 'STRING',
	address: 'STRING',
	address2: 'STRING',
	postcode: 'STRING',
	regionCode: 'STRING',
	fax: 'STRING',
	fiscalInformation: 'STRING',
	website: 'STRING',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const CONTACT_SORTABLE = ['createdAt', 'updatedAt', 'name', 'firstName', 'lastName', 'city', 'country'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list read declares no order of its own and the store answers in its own, so this is
 * not a reproduction of the route's order — there is none to reproduce — but the order that makes a
 * cursor walk total: newest first, with the identifier as the last key so that two rows written in
 * the same millisecond still have one order between them.
 */
const CONTACT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The customer record over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `ContactService` the `/api/contact` routes call.
 *
 * **The guard is the controller's guard, and no permission is stated above it.** The delivered
 * controller carries `TenantPermissionGuard` on the class and states no `@Permissions` anywhere —
 * not on its own list route and not on any of the routes it inherits from the CRUD base — so every
 * one of its routes is tenant-guarded and otherwise unpermissioned. A resolver that demanded a
 * permission here would refuse a caller the REST route serves, which is exactly the asymmetry the
 * two-protocol rule forbids; tightening the resource is a change to make in both places at once, and
 * it is not this delivery's to make.
 *
 * **The list is a connection, and no relation is a field of it.** The delivered list read answers
 * the row and the relations its caller named, and the connection joins none of them: the type
 * carries what always travels, and the party that points at this row is reached from the row that
 * owns the foreign key.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('Contact')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class ContactResolver {
	constructor(private readonly contactService: ContactService) {}

	/**
	 * The contacts of the caller's tenant.
	 */
	@Query('contacts')
	async contacts(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<Contact>> {
		// The delivered list route hands the service the `where` and the `relations` its `data` query
		// parameter carries. This surface has no query string to bind, so the read runs with no
		// narrowing of its own — the tenant is applied to the criterion by the service, from the
		// credential rather than from the caller — and the connection protocol's `filter` is applied to
		// the rows it returns.
		const { items }: IPagination<Contact> = await this.contactService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) });

		return buildConnection<Contact>({
			rows: items ?? [],
			filterable: CONTACT_FILTERABLE,
			sortable: CONTACT_SORTABLE,
			defaultSort: CONTACT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One contact of the caller's tenant.
	 *
	 * A contact that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact
	 * stated in the other protocol's vocabulary.
	 */
	@Query('contact')
	async contact(@Args('id', { type: () => ID }) id: Id): Promise<Contact | null> {
		try {
			return await this.contactService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many contacts the caller's tenant holds.
	 *
	 * The same call the count route makes, with the same absence of narrowing. That route binds its
	 * query string to the store's own `where` and hands it to `countBy`; the connection protocol has
	 * no argument of that shape, so the field passes none and counts the caller's own rows — the
	 * tenant is applied to the criterion by the service, from the credential rather than from the
	 * caller, which is what the route's bare call counts too.
	 */
	@Query('contactCount')
	async contactCount(): Promise<number> {
		return await this.contactService.countBy();
	}

	/**
	 * Records a contact.
	 *
	 * The payload is the input as stated, and the tenant is the credential's: the service stamps it
	 * and overwrites whatever a body states, so a caller states which organization the row is filed
	 * under and never which tenant it is written into.
	 */
	@Mutation('createContact')
	async createContact(@Args('input') input: ICreateContactInput): Promise<Contact> {
		return await this.contactService.create(input as unknown as Contact);
	}

	/**
	 * Changes the facts of a contact.
	 *
	 * The identifier is the criterion and is not repeated in the payload, which is the shape the
	 * route itself has: `:id` names the row and the body carries only what changes. A member the
	 * caller leaves out is left as it is, because the delivered edit is a partial column update
	 * rather than a replacement of the row.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered
	 * route answers the store's own update result — a statement about the write, `{ affected }` —
	 * which is not a row and not what a GraphQL field named `updateContact` may return.
	 */
	@Mutation('updateContact')
	async updateContact(@Args('input') input: IUpdateContactInput): Promise<Contact> {
		const { id, ...values } = input;

		await this.contactService.update(id, values as unknown as QueryDeepPartialEntity<Contact>);

		return await this.contactService.findOneByIdString(id);
	}

	/**
	 * Removes a contact outright.
	 *
	 * The delivered service refuses a row that is not there with the same `404` the REST route
	 * answers with, so a caller that names one is told it is missing rather than that the removal
	 * succeeded.
	 */
	@Mutation('deleteContact')
	async deleteContact(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.contactService.delete(id);

		return true;
	}

	/**
	 * Withdraws a contact: the row is marked rather than removed, and the recovery below reads it
	 * back.
	 *
	 * The delivered route declares no query parameter of its own and passes the service the option
	 * list it bound from the query string, so the field states none either.
	 */
	@Mutation('softDeleteContact')
	async softDeleteContact(@Args('id', { type: () => ID }) id: Id): Promise<Contact> {
		return await this.contactService.softRemove(id);
	}

	/**
	 * Puts a withdrawn contact back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverContact')
	async recoverContact(@Args('id', { type: () => ID }) id: Id): Promise<Contact> {
		return await this.contactService.softRecover(id);
	}
}

import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { AddressOwnerType, IAddressBook, ID as Id, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { AddressRoleEnum } from '../address-role/address-role.enums';
import { AddressService } from './address.service';

/**
 * The members `CreateAddressInput` declares in the schema.
 */
export interface ICreateAddressInput {
	organizationId: Id;
	label?: string;
	contactName?: string;
	company?: string;
	firstName?: string;
	lastName?: string;
	phone?: string;
	email?: string;
	line1: string;
	line2?: string;
	city: string;
	province?: string;
	provinceCode?: string;
	postalCode?: string;
	countryCode: string;
	countryId?: Id;
	latitude?: number;
	longitude?: number;
	isDefaultShipping?: boolean;
	isDefaultBilling?: boolean;
	ownerType?: AddressOwnerType;
	ownerId: Id;
	customerId?: Id;
	metadata?: Record<string, unknown>;
}

/**
 * The members `UpdateAddressInput` declares in the schema.
 */
export interface IUpdateAddressInput extends Partial<ICreateAddressInput> {
	id: Id;
}

/**
 * The members `SetDefaultAddressInput` declares in the schema.
 */
export interface ISetDefaultAddressInput {
	id: Id;
	role: AddressRoleEnum;
	isDefault?: boolean;
}

/**
 * The fields an address list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `AddressFilter` and `AddressSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly. The
 * validation verdict is deliberately absent from both: a field the platform never lets a caller write
 * is a field it does not let one search on either.
 */
const ADDRESS_FILTERABLE = {
	id: 'ID',
	label: 'STRING',
	contactName: 'STRING',
	company: 'STRING',
	phone: 'STRING',
	email: 'STRING',
	line1: 'STRING',
	line2: 'STRING',
	city: 'STRING',
	province: 'STRING',
	provinceCode: 'STRING',
	postalCode: 'STRING',
	countryCode: 'STRING',
	countryId: 'ID',
	isDefaultShipping: 'BOOLEAN',
	isDefaultBilling: 'BOOLEAN',
	isValidated: 'BOOLEAN',
	ownerType: 'ENUM',
	ownerId: 'ID',
	customerId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const ADDRESS_SORTABLE = [
	'createdAt',
	'updatedAt',
	'label',
	'city',
	'countryCode',
	'postalCode',
	'isDefaultShipping',
	'isDefaultBilling'
] as const;

/**
 * The order the delivered list method means: newest first. The connection reproduces it rather than
 * replacing it, so the REST answer and this one list the same rows in the same order when neither
 * caller states a sort.
 */
const ADDRESS_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The address book over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `AddressService` the `/api/addresses` routes call, under
 * the same guard chain and the same permission. A client that reaches a capability over one protocol
 * is not given a narrower or a wider one than the client that reaches it over the other.
 *
 * **The defaults are moved through the service, never written here.** `setDefaultAddress` calls
 * `setDefaultAddress` or `clearDefaultAddress` — the two operations that keep the party's
 * authoritative column, the address's mirror boolean and the role row one fact — so neither protocol
 * offers a way to write the boolean directly, which is the property the address book's own service
 * exists to hold.
 *
 * **The contact-token half of the authorisation column cannot be implemented.** No contact subject
 * exists in `RequestContext` and no decorator establishes one, so this resolver is guarded on the
 * same staff permission the REST route carries — `ORG_CONTACT_VIEW` to read, `ORG_CONTACT_EDIT` to
 * write — and no authentication path is invented to stand in for the one the specification assumes.
 *
 * **`withDeleted` is deliberately absent.** A repository option the delivered list methods do not
 * expose, and an argument that cannot be honoured is worse than an absent one.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('Address')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
export class AddressResolver {
	constructor(private readonly addressService: AddressService) {}

	/**
	 * The addresses of the caller's organization, newest first.
	 */
	@Query('addresses')
	@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
	async addresses(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IAddressBook>> {
		const rows = await this.addressService.listAddresses();

		return buildConnection<IAddressBook>({
			rows,
			filterable: ADDRESS_FILTERABLE,
			sortable: ADDRESS_SORTABLE,
			defaultSort: ADDRESS_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One address of the caller's organization, or `null` when there is none.
	 */
	@Query('address')
	@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
	async address(@Args('id', { type: () => ID }) id: Id): Promise<IAddressBook | null> {
		return this.addressService.findAddress(id);
	}

	/**
	 * Records an address.
	 */
	@Mutation('createAddress')
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async createAddress(@Args('input') input: ICreateAddressInput): Promise<IAddressBook> {
		return this.addressService.createAddress(input as never);
	}

	/**
	 * Changes the descriptive facts of an address.
	 */
	@Mutation('updateAddress')
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async updateAddress(@Args('input') input: IUpdateAddressInput): Promise<IAddressBook> {
		return this.addressService.updateAddress(input.id, input as never);
	}

	/**
	 * Removes an address, softly.
	 */
	@Mutation('deleteAddress')
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async deleteAddress(@Args('id', { type: () => ID }) id: Id): Promise<IAddressBook> {
		return this.addressService.softRemoveAddress(id);
	}

	/**
	 * Makes an address the party's default for one role, or clears that default.
	 *
	 * Both directions are one operation because they are one fact, and each has exactly one method
	 * that reaches it: a default is never written as a boolean here either.
	 */
	@Mutation('setDefaultAddress')
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async setDefaultAddress(@Args('input') input: ISetDefaultAddressInput): Promise<IAddressBook> {
		return input.isDefault === false
			? this.addressService.clearDefaultAddress(input.id, input.role)
			: this.addressService.setDefaultAddress(input.id, input.role);
	}
}

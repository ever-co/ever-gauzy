import { ParseEnumPipe, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { PermissionsEnum, ID } from '@gauzy/contracts';
import { AddressRole } from './address-role.entity';
import { AddressRoleService } from './address-role.service';
import { AddressRoleEnum } from './address-role.enums';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';

/** The members `CreateAddressRoleInput` declares in the schema. */
export interface ICreateAddressRoleInput {
	organizationId: string;
	addressId: string;
	role: AddressRoleEnum;
	isDefault?: boolean;
}

/**
 * What a row of the address book is *for*, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `AddressRoleService` the `/api/address-roles` routes call,
 * under the same guard chain and the same permission — the address book's own. A role is a dimension of
 * the address book rather than a resource with access rules of its own, and this surface says so by
 * guarding with `ORG_CONTACT_*` rather than inventing a pair.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('AddressRole')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
export class AddressRoleResolver {
	constructor(private readonly addressRoleService: AddressRoleService) {}

	/**
	 * The roles one address plays.
	 */
	@Query('addressRoles')
	@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
	async addressRoles(@Args('addressId', ParseUUIDPipe) addressId: ID): Promise<AddressRole[]> {
		return this.addressRoleService.listForAddress(addressId);
	}

	/**
	 * The default address for a role among the addresses of one owner, or `null` when none claims it.
	 *
	 * Two candidates claiming the role is refused rather than resolved: there is no rule that says which
	 * of them is right, and silently picking one is how two clients come to disagree.
	 */
	@Query('addressRoleDefault')
	@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
	async addressRoleDefault(
		@Args('role', new ParseEnumPipe(AddressRoleEnum)) role: AddressRoleEnum,
		@Args('ownerAddressIds', { type: () => [String] }) ownerAddressIds: ID[]
	): Promise<ID | null> {
		return this.addressRoleService.defaultFor(role, ownerAddressIds);
	}

	/**
	 * Gives an address a role.
	 */
	@Mutation('assignAddressRole')
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async assignAddressRole(@Args('input') input: ICreateAddressRoleInput): Promise<AddressRole> {
		return this.addressRoleService.assign(input.addressId, input.role, { isDefault: input.isDefault });
	}

	/**
	 * Makes one address the default for a role, clearing the flag on the siblings the caller names.
	 */
	@Mutation('setAddressRoleDefault')
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async setAddressRoleDefault(
		@Args('addressId', ParseUUIDPipe) addressId: ID,
		@Args('role', new ParseEnumPipe(AddressRoleEnum)) role: AddressRoleEnum,
		@Args('ownerAddressIds', { type: () => [String] }) ownerAddressIds: ID[]
	): Promise<AddressRole> {
		return this.addressRoleService.setDefault(addressId, role, ownerAddressIds);
	}

	/**
	 * Removes a role from an address.
	 */
	@Mutation('revokeAddressRole')
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async revokeAddressRole(
		@Args('addressId', ParseUUIDPipe) addressId: ID,
		@Args('role', new ParseEnumPipe(AddressRoleEnum)) role: AddressRoleEnum
	): Promise<boolean> {
		await this.addressRoleService.revoke(addressId, role);

		return true;
	}

	/**
	 * Withdraws an address role without removing the row — the GraphQL counterpart of `DELETE /address-roles/:id/soft`.
	 *
	 * The same service method the route reaches, under the same grant: the edit grant its `update` states, which
	 * the controller now states on the route too (owner decision 5, 2026-10-13 — the soft-delete/recover pair
	 * requires the controller's own edit grant). The route used to be inherited from `CrudController` with no
	 * permission of its own and so stood on the class's `ORG_CONTACT_VIEW`; a field mirroring it then would have
	 * carried that read grant, which is why the pair is delivered together with the route's grant.
	 */
	@Mutation('softDeleteAddressRole')
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async softDeleteAddressRole(@Args('id', ParseUUIDPipe) id: string): Promise<AddressRole> {
		return this.addressRoleService.softRemove(id);
	}

	/**
	 * Restores a withdrawn row — the GraphQL counterpart of `PUT /address-roles/:id/recover`, under the withdrawal's
	 * grant: restoring undoes a removal.
	 */
	@Mutation('recoverAddressRole')
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async recoverAddressRole(@Args('id', ParseUUIDPipe) id: string): Promise<AddressRole> {
		return this.addressRoleService.softRecover(id);
	}
}

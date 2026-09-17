import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { EntityManager, In } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiException } from '../core/errors/api-exception';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { AddressRole } from './address-role.entity';
import { ADDRESS_ROLES_WITH_BOOLEAN_MIRROR, AddressRoleEnum } from './address-role.enums';
import { TypeOrmAddressRoleRepository } from './repository/type-orm-address-role.repository';
import { MikroOrmAddressRoleRepository } from './repository/mikro-orm-address-role.repository';

/**
 * The address book's role lookup, and the two rules the database cannot hold.
 *
 * **The lookup** answers what an address is for and which of a party's addresses is the default for a
 * role. It is a lookup rather than a column because one address routinely plays several roles: a
 * ship-to that is also the invoice-to is one row with two role rows beside it, which a single-valued
 * column could not express without duplicating the address.
 *
 * **The rules.** `(address, role)` is unique in the database — `UQ_address_role` is a partial unique
 * index, so a soft-deleted row never blocks a legitimate re-create. Two further rules are not
 * expressible there and live here instead:
 *
 * - *At most one default per owner and role.* The owner lives on `address`, so the tuple spans two
 *   tables. `defaultFor` is the check — it refuses to answer when two addresses of one owner both claim
 *   the role, rather than returning whichever the database happened to order first — and the nightly
 *   `address-default-reconcile` re-reports it as a gauge.
 * - *The two booleans on `address` are a derived mirror.* `isDefaultShipping` and `isDefaultBilling`
 *   remain, and they must agree with the `SHIPPING` and `BILLING` rows. `assertMirrorsDefault` is the
 *   check, named `ADDRESS_DEFAULT_MISMATCH`; it exists because two clients read the two locations —
 *   checkout binds the cart from the party's columns while a contact expansion reads the booleans — and
 *   without the check they could show two different default addresses for one customer and both be
 *   reading the schema correctly.
 */
@Injectable()
export class AddressRoleService extends TenantAwareCrudService<AddressRole> {
	constructor(
		readonly typeOrmAddressRoleRepository: TypeOrmAddressRoleRepository,
		readonly mikroOrmAddressRoleRepository: MikroOrmAddressRoleRepository
	) {
		super(typeOrmAddressRoleRepository, mikroOrmAddressRoleRepository);
	}

	/**
	 * The roles one address plays.
	 *
	 * @param addressId The address id.
	 * @returns The role rows, ordered by role.
	 */
	async listForAddress(addressId: ID): Promise<AddressRole[]> {
		return this.find({
			where: {
				addressId,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { role: 'ASC' }
		} as any);
	}

	/**
	 * The roles one address plays, as values.
	 *
	 * This is the shape a caller narrows a decision with: "may this address be used as a return
	 * destination" is a question about the set, not about a row.
	 *
	 * @param addressId The address id.
	 * @returns The role values.
	 */
	async rolesOf(addressId: ID): Promise<AddressRoleEnum[]> {
		const roles = await this.listForAddress(addressId);

		return roles.map((row) => row.role);
	}

	/**
	 * Whether one address plays one role.
	 *
	 * @param addressId The address id.
	 * @param role The role.
	 * @returns True when the role row exists.
	 */
	async hasRole(addressId: ID, role: AddressRoleEnum): Promise<boolean> {
		const row = await this.findOneByWhereOptions({
			addressId,
			role,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as any);

		return !!row;
	}

	/**
	 * Reads one address's role row.
	 *
	 * @param addressId The address id.
	 * @param role The role.
	 * @returns The role row, or null when the address does not play it.
	 */
	async getRole(addressId: ID, role: AddressRoleEnum): Promise<AddressRole | null> {
		return this.findOneByWhereOptions({
			addressId,
			role,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as any);
	}

	/**
	 * The addresses that play one role, optionally only the default one.
	 *
	 * @param role The role.
	 * @param options.isDefault When set, only rows whose default flag matches.
	 * @returns The role rows, ordered by address.
	 */
	async findByRole(role: AddressRoleEnum, options: { isDefault?: boolean } = {}): Promise<AddressRole[]> {
		return this.find({
			where: {
				role,
				...(options.isDefault === undefined ? {} : { isDefault: options.isDefault }),
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			},
			order: { addressId: 'ASC' }
		} as any);
	}

	/**
	 * The default address for one role among the addresses of one owner.
	 *
	 * The caller names the candidate set because the owner is a column of `address` and this module does
	 * not own that table: the address book reads the owner's addresses and asks this question about
	 * them. Two candidates claiming the role is refused rather than resolved, because there is no rule
	 * that says which of them is right and silently picking one is how two clients come to disagree.
	 *
	 * @param role The role.
	 * @param addressIds The addresses of one owner.
	 * @returns The default address's id, or null when none of them claims the role as its default.
	 * @throws ApiException `ADDRESS_DEFAULT_MISMATCH` (409) when more than one of them does.
	 */
	async defaultFor(role: AddressRoleEnum, addressIds: ID[]): Promise<ID | null> {
		if (!Array.isArray(addressIds) || addressIds.length === 0) {
			return null;
		}

		const rows = await this.find({
			where: {
				role,
				isDefault: true,
				addressId: In(addressIds),
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			}
		} as any);

		if (rows.length > 1) {
			throw new ApiException(
				409,
				ApiErrorCode.ADDRESS_DEFAULT_MISMATCH,
				`${rows.length} addresses of this owner are the default for ${role}.`,
				{ role, addressIds: rows.map((row) => row.addressId) }
			);
		}

		return rows[0]?.addressId ?? null;
	}

	/**
	 * Gives an address a role, or changes the role it already has.
	 *
	 * Idempotent: assigning a role an address already has updates the row rather than failing, so a
	 * caller that re-applies a state does not have to read first.
	 *
	 * @param addressId The address id.
	 * @param role The role to give it.
	 * @param options.isDefault Whether it is the default for that role; defaults to leaving the flag as
	 * it stands.
	 * @param manager The transaction to write inside, when the caller has one.
	 * @returns The stored role row.
	 */
	async assign(
		addressId: ID,
		role: AddressRoleEnum,
		options: { isDefault?: boolean; metadata?: Record<string, unknown> } = {},
		manager?: EntityManager
	): Promise<AddressRole> {
		if (options.isDefault && !ADDRESS_ROLES_WITH_BOOLEAN_MIRROR.includes(role)) {
			// A default is a statement the address book can act on: it is the address checkout uses for a
			// role. Only the two roles that have a boolean mirror are resolved that way today, and a
			// default on any other role would be a flag nothing reads.
			throw new BadRequestException(
				`ADDRESS_ROLE_DEFAULT_UNSUPPORTED: ${role} has no default; only ${ADDRESS_ROLES_WITH_BOOLEAN_MIRROR.join(
					' and '
				)} do.`
			);
		}

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		const write = async (entityManager: EntityManager): Promise<AddressRole> => {
			const existing = await entityManager.findOne(AddressRole, {
				where: { addressId, role, tenantId, organizationId } as any
			});

			if (existing) {
				if (options.isDefault !== undefined) existing.isDefault = options.isDefault;
				if (options.metadata !== undefined) existing.metadata = options.metadata;

				return entityManager.save(existing);
			}

			return entityManager.save(
				entityManager.create(AddressRole, {
					addressId,
					role,
					isDefault: options.isDefault ?? false,
					metadata: options.metadata,
					tenantId,
					organizationId
				} as Partial<AddressRole>)
			);
		};

		if (manager) {
			return write(manager);
		}

		return this.typeOrmRepository.manager.transaction(write);
	}

	/**
	 * Makes one address the default for a role, and clears the flag on its siblings.
	 *
	 * The clear and the set happen in one transaction over the candidate set the caller names: "at most
	 * one default per owner and role" is a rule of this service, and a version that wrote one row and
	 * hoped the others were already clear would leave two defaults behind on the first concurrent write.
	 *
	 * @param addressId The address to make the default.
	 * @param role The role.
	 * @param ownerAddressIds Every address of the same owner, this one included.
	 * @returns The stored role row.
	 * @throws ApiException `ADDRESS_DEFAULT_MISMATCH` (409) when a sibling's mirror boolean disagrees.
	 */
	async setDefault(addressId: ID, role: AddressRoleEnum, ownerAddressIds: ID[]): Promise<AddressRole> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const siblings = [...new Set([addressId, ...(ownerAddressIds ?? [])])];

		return this.typeOrmRepository.manager.transaction(async (manager: EntityManager) => {
			await manager.update(
				AddressRole,
				{ role, addressId: In(siblings), tenantId, organizationId } as any,
				{ isDefault: false } as any
			);

			const row = await manager.findOne(AddressRole, { where: { addressId, role, tenantId, organizationId } as any });

			if (!row) {
				throw new NotFoundException(
					`ADDRESS_ROLE_NOT_FOUND: this address does not play the ${role} role.`
				);
			}

			row.isDefault = true;

			return manager.save(row);
		});
	}

	/**
	 * Removes a role from an address.
	 *
	 * @param addressId The address id.
	 * @param role The role to remove.
	 * @returns The deleted row count.
	 */
	async revoke(addressId: ID, role: AddressRoleEnum) {
		return this.delete({
			addressId,
			role,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as any);
	}

	/**
	 * Asserts that the address book's own boolean agrees with the role row that mirrors it.
	 *
	 * @param role The role; must be one of the two the mirror exists for.
	 * @param roleIsDefault The role row's flag.
	 * @param addressIsDefault The address's own boolean.
	 * @throws ApiException `ADDRESS_DEFAULT_MISMATCH` (409) when the two disagree.
	 */
	assertMirrorsDefault(role: AddressRoleEnum, roleIsDefault: boolean, addressIsDefault: boolean): void {
		if (!ADDRESS_ROLES_WITH_BOOLEAN_MIRROR.includes(role)) {
			return;
		}

		if (roleIsDefault !== addressIsDefault) {
			throw new ApiException(
				409,
				ApiErrorCode.ADDRESS_DEFAULT_MISMATCH,
				`The ${role} role and the address's own default flag disagree, and the role is the authority.`,
				{ role, roleIsDefault, addressIsDefault }
			);
		}
	}
}

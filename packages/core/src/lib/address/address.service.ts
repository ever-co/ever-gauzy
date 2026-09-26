import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import {
	AddressOwnerType,
	IAddressBook,
	IAddressBookCreateInput,
	IAddressBookFindInput,
	IAddressBookUpdateInput,
	ID
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { Country } from '../country/country.entity';
import { OrganizationContact } from '../organization-contact/organization-contact.entity';
import { AddressRole } from '../address-role/address-role.entity';
import { AddressRoleEnum } from '../address-role/address-role.enums';
import { AddressRoleService } from '../address-role/address-role.service';
import { Address } from './address.entity';
import { TypeOrmAddressRepository } from './repository/type-orm-address.repository';
import { MikroOrmAddressRepository } from './repository/mikro-orm-address.repository';

/**
 * One role an address plays, as a caller states it when it replaces the address's role set.
 *
 * The role vocabulary itself lives with the pivot (`AddressRoleEnum`), because the pivot is where it
 * was delivered and one fact gets one spelling.
 */
export interface IAddressRoleAssignment {
	/** The role the address plays. */
	role: AddressRoleEnum;
	/** Whether it is the default for that role. Only `SHIPPING` and `BILLING` have a default. */
	isDefault?: boolean;
	/** Tenant extras kept on the role row. */
	metadata?: Record<string, unknown>;
}

/**
 * The address book: reusable postal addresses, and the rules the rows of the table cannot hold.
 *
 * Read the rules of this service as one rule with four faces.
 *
 * 1. **The owner is a pair, and the buyer reference must agree with it.** `ownerType` names what kind
 *    of thing the address belongs to and `ownerId` names it — the target is decided by a column value,
 *    so no portable foreign key can carry the rule, and this service is where it is paid for. A
 *    `CONTACT` address whose `customerId` is stated must name the same row the owner pair names, and
 *    an address whose owner is **not** a party carries no buyer reference at all. Both refusals are
 *    `ADDRESS_OWNER_MISMATCH`. The one case that is not a refusal is the anonymous cart address the
 *    table describes: a contact address created before the customer registers carries no `customerId`
 *    and the guest sentinel as its owner, and the nightly `address-default-reconcile` reports it
 *    rather than this service inventing a party for it.
 * 2. **`countryCode` is a two-letter upper-case code and `countryId` follows it.** The code decides
 *    what a tax rate, a shipping option and a carrier label match on, so it is normalised on every
 *    write and refused when it is not two letters. The lookup row is then resolved from the code, and
 *    cleared when the code matches nothing: an address may legitimately carry a code the platform's
 *    own country list does not contain, and refusing it would reject a real destination because the
 *    reference list is short. The invariant is "filled when and only when the code matches", so a
 *    stated `countryId` that the resolution does not confirm is refused rather than stored.
 * 3. **The defaults have one authority and it is the party's own columns.** `organization_contact.
 *    defaultShippingAddressId` / `.defaultBillingAddressId` are authoritative; the address's two
 *    booleans are their **derived mirror**, and the `address_role` row for `SHIPPING` / `BILLING` is
 *    the role dimension of the same fact. All three are written in one transaction by
 *    {@link setDefaultAddress} and {@link clearDefaultAddress}, so a caller can never leave two
 *    answers to one question. A write that disagrees with the authority — clearing a flag on the
 *    address the party names, or stating a role default that contradicts the address's own boolean —
 *    fails with `ADDRESS_DEFAULT_MISMATCH` rather than being quietly reconciled.
 * 4. **Removal is a soft delete and it never rewrites a document.** An order snapshots the address it
 *    was placed with, so deleting a row here cannot change a historical order; the supported path is
 *    this service's soft delete, and a hard delete is not offered. An address that is the party's
 *    current default is refused, because deleting it would leave the party's column naming a row that
 *    is gone — the caller moves the default first, which is one call and keeps the two locations in
 *    step. The address's role rows go with it.
 *
 * The row is never hard-deleted while anything references it: `payment_method_token.billingAddressId`
 * and `address_role.addressId` both point here, and neither is this service's to cascade.
 */
@Injectable()
export class AddressService extends TenantAwareCrudService<Address> {
	/**
	 * The descriptive members a create or an update copies straight through. Stated once, so a member
	 * added to the table is added in one place rather than in two hand-written payloads.
	 */
	private static readonly DESCRIPTIVE_MEMBERS = [
		'label',
		'contactName',
		'company',
		'firstName',
		'lastName',
		'phone',
		'email',
		'line1',
		'line2',
		'city',
		'province',
		'provinceCode',
		'postalCode',
		'latitude',
		'longitude',
		'metadata'
	] as const;

	/**
	 * The members a create or a descriptive update may not carry: they are the address-validation
	 * strategy's verdict, written by the operation that actually asks a validator. Refused rather than
	 * ignored, because a caller that believes it validated an address would otherwise never learn that
	 * it did not.
	 */
	private static readonly VALIDATION_MEMBERS = ['isValidated', 'validationProviderKey'] as const;

	constructor(
		readonly typeOrmAddressRepository: TypeOrmAddressRepository,
		readonly mikroOrmAddressRepository: MikroOrmAddressRepository,
		/**
		 * The role pivot, for the one fact the two domains share: an address's role rows are the role
		 * dimension of the same default the address's own booleans mirror. The dependency runs one way —
		 * the pivot reads no address and asks no question of it — so no cycle is created by the book
		 * writing the roles of its own rows.
		 */
		private readonly addressRoleService: AddressRoleService
	) {
		super(typeOrmAddressRepository, mikroOrmAddressRepository);
	}

	/**
	 * The tenant and organization of the caller, which every query in this service is scoped to.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Records an address in the caller's book.
	 *
	 * The defaults are deliberately not written here. An address is created with both booleans false
	 * and, when the caller asked for one of them, {@link setDefaultAddress} is what makes it the
	 * default — the same call the dedicated endpoint uses — so there is exactly one code path that
	 * moves a default and it always clears the sibling it replaces. Writing the boolean here and
	 * hoping the siblings were already clear is how a party ends up with two defaults on the first
	 * concurrent write.
	 *
	 * @param input The address as the caller states it.
	 * @returns The stored address.
	 * @throws BadRequestException `VALIDATION_REQUIRED_FIELD` when the street line, the city, the
	 * country code or the owner id is missing, `VALIDATION_FAILED` when the country code is not a
	 * two-letter code or a stated `countryId` contradicts it, `VALIDATION_INVALID_ENUM` when the owner
	 * type is not one the vocabulary holds, and `VALIDATION_UNKNOWN_FIELD` when the body states a
	 * validation verdict.
	 * @throws ApiException `ADDRESS_OWNER_MISMATCH` (409) when the buyer reference contradicts the
	 * owner pair.
	 */
	async createAddress(input: IAddressBookCreateInput): Promise<IAddressBook> {
		const stated = (input ?? {}) as unknown as Record<string, unknown>;

		this.assertNoValidationVerdict(stated);

		if (!input || !this.isStated(input.line1)) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_REQUIRED_FIELD}: an address is stated with the street line it names, and none was presented.`
			);
		}

		if (!this.isStated(input.city)) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_REQUIRED_FIELD}: an address is stated with the city it names, and none was presented.`
			);
		}

		const countryCode = this.normaliseCountryCode(input.countryCode);
		const ownerType = input.ownerType ?? AddressOwnerType.CONTACT;

		this.assertOwnerType(ownerType);
		this.assertOwnerConsistency(ownerType, input.ownerId, input.customerId);

		const manager = this.typeOrmAddressRepository.manager;
		const countryId = await this.resolveCountryId(manager, countryCode, input.countryId);

		const created = await this.create({
			...this.descriptive(stated),
			countryCode,
			countryId,
			ownerType,
			ownerId: input.ownerId,
			customerId: input.customerId ?? null,
			// Stated rather than left to the column defaults: a row written through a path that ignores
			// defaults would otherwise carry no default and no verdict at all, and "not the default" is
			// a fact about the row rather than an absence.
			isDefaultShipping: false,
			isDefaultBilling: false,
			isValidated: false,
			...this.scope
		} as never);

		if (input.isDefaultShipping) {
			await this.setDefaultAddress(created.id, AddressRoleEnum.SHIPPING);
		}

		if (input.isDefaultBilling) {
			await this.setDefaultAddress(created.id, AddressRoleEnum.BILLING);
		}

		return this.findAddressOrFail(created.id);
	}

	/**
	 * Loads an address that belongs to the caller's organization.
	 *
	 * @param id The address id.
	 * @returns The address.
	 * @throws NotFoundException `RESOURCE_NOT_FOUND` when it does not exist inside the caller's scope.
	 */
	async findAddressOrFail(id: ID): Promise<IAddressBook> {
		const address = await this.findAddress(id);

		if (!address) {
			throw new NotFoundException(`${ApiErrorCode.RESOURCE_NOT_FOUND}: no such address in this organization.`);
		}

		return address;
	}

	/**
	 * Lists the addresses of the caller's organization.
	 *
	 * @param filter Optional narrowing by party, country code, owner pair or default flag.
	 * @returns The addresses, newest first.
	 */
	async listAddresses(filter: IAddressBookFindInput = {}): Promise<IAddressBook[]> {
		return this.find({
			where: {
				...(filter.customerId ? { customerId: filter.customerId } : {}),
				...(filter.countryCode ? { countryCode: this.normaliseCountryCode(filter.countryCode) } : {}),
				...(filter.ownerType ? { ownerType: filter.ownerType } : {}),
				...(filter.ownerId ? { ownerId: filter.ownerId } : {}),
				...(filter.isDefaultShipping === undefined ? {} : { isDefaultShipping: filter.isDefaultShipping }),
				...(filter.isDefaultBilling === undefined ? {} : { isDefaultBilling: filter.isDefaultBilling }),
				...(filter.isValidated === undefined ? {} : { isValidated: filter.isValidated }),
				...this.scope
			},
			order: { createdAt: 'DESC' }
		} as never);
	}

	/**
	 * Changes the descriptive facts of an address.
	 *
	 * A stated default flag is not written here either: it is routed to {@link setDefaultAddress} or
	 * refused by {@link clearDefaultAddress}, so the party's authoritative column, the address's
	 * boolean and the role row all move together whichever door the caller came through.
	 *
	 * @param id The address to change.
	 * @param input The facts to change.
	 * @returns The stored address.
	 * @throws BadRequestException as {@link createAddress}, and `VALIDATION_REQUIRED_FIELD` when a
	 * descriptive field is cleared to empty.
	 * @throws ApiException `ADDRESS_OWNER_MISMATCH` (409) when the owner pair and the buyer reference
	 * would disagree, and `ADDRESS_DEFAULT_MISMATCH` (409) when a default is cleared on the address
	 * the party names as its default.
	 * @throws NotFoundException when the address is not in the caller's scope.
	 */
	async updateAddress(id: ID, input: IAddressBookUpdateInput): Promise<IAddressBook> {
		const address = await this.findAddressOrFail(id);
		const stated = (input ?? {}) as unknown as Record<string, unknown>;

		this.assertNoValidationVerdict(stated);

		const ownerType = (input.ownerType ?? address.ownerType) as AddressOwnerType;
		const ownerId = input.ownerId ?? address.ownerId;
		const customerId =
			input.customerId === undefined ? address.customerId : (input.customerId as ID | null | undefined);

		this.assertOwnerType(ownerType);
		this.assertOwnerConsistency(ownerType, ownerId, customerId);

		if (input.line1 !== undefined && !this.isStated(input.line1)) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_REQUIRED_FIELD}: 'line1' is what the address is, and it is never cleared.`
			);
		}

		if (input.city !== undefined && !this.isStated(input.city)) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_REQUIRED_FIELD}: 'city' is what the address is, and it is never cleared.`
			);
		}

		const countryCode = input.countryCode === undefined ? address.countryCode : this.normaliseCountryCode(input.countryCode);
		const countryId = await this.resolveCountryId(
			this.typeOrmAddressRepository.manager,
			countryCode,
			input.countryId === undefined ? undefined : input.countryId
		);

		const descriptive = {
			...this.descriptive(stated),
			countryCode,
			countryId,
			ownerType,
			ownerId,
			customerId: customerId ?? null
		};

		if (Object.keys(descriptive).length) {
			await this.update(id, descriptive as never);
		}

		if (input.isDefaultShipping !== undefined) {
			await this.applyDefault(id, AddressRoleEnum.SHIPPING, input.isDefaultShipping);
		}

		if (input.isDefaultBilling !== undefined) {
			await this.applyDefault(id, AddressRoleEnum.BILLING, input.isDefaultBilling);
		}

		return this.findAddressOrFail(id);
	}

	/**
	 * Makes one address the party's default for one role, in one transaction.
	 *
	 * The three locations of a single fact are written together, deliberately: the role row through the
	 * pivot, the address's own boolean, and the party's authoritative reference. The sibling addresses
	 * of the same owner are cleared first, so "at most one default per owner and role" holds at every
	 * instant rather than only at the end — which is what the partial unique indexes require on the two
	 * dialects that can express them, and what the service check provides on the third.
	 *
	 * @param id The address to make the default.
	 * @param role The role it becomes the default for; only `SHIPPING` and `BILLING` have a default.
	 * @returns The stored address.
	 * @throws BadRequestException `VALIDATION_INVALID_ENUM` when the role has no default.
	 * @throws ApiException `ADDRESS_DEFAULT_MISMATCH` (409) when the party's column names a different
	 * address and the pivot refuses to move a default it cannot reconcile.
	 * @throws NotFoundException when the address is not in the caller's scope.
	 */
	async setDefaultAddress(id: ID, role: AddressRoleEnum): Promise<IAddressBook> {
		const flag = this.mirroredFlag(role);

		await this.typeOrmAddressRepository.manager.transaction(async (manager: EntityManager) => {
			const address = await this.lockAddress(manager, id);

			if (!address) {
				throw new NotFoundException(`${ApiErrorCode.RESOURCE_NOT_FOUND}: no such address in this organization.`);
			}

			const book = await this.ownerBook(manager, address);
			const siblings = book.filter((one) => one.id !== address.id).map((one) => one.id);

			if (siblings.length) {
				// Cleared before the flag is set: on the dialects whose partial unique index makes the
				// rule a database guarantee, setting first would collide with the sibling it replaces.
				await manager.update(
					Address,
					{ id: In(siblings), ...this.scope } as never,
					{ [flag]: false } as never
				);
			}

			// The pivot's own rule, in the same transaction: the role row exists, the siblings' flags are
			// cleared and this one becomes the default.
			await this.addressRoleService.assign(address.id, role, { isDefault: true }, manager);
			await this.addressRoleService.setDefault(address.id, role, book.map((one) => one.id), manager);

			// The mirror, then the authority.
			await manager.update(Address, { id: address.id, ...this.scope } as never, { [flag]: true } as never);
			await this.writePartyDefault(manager, address, role, address.id);
		});

		return this.findAddressOrFail(id);
	}

	/**
	 * Removes the default from one role, in one transaction, wherever it currently sits.
	 *
	 * A party is allowed to have no default address at all — that is an ordinary state, and this is the
	 * call that reaches it. **This** is where the party's column and the address's boolean are cleared
	 * together, which is the whole point of the operation: it is the one door through which "no default"
	 * is written without leaving the authority and the mirror disagreeing. The descriptive path refuses
	 * instead — a body that states `isDefaultShipping: false` while the party's column names that
	 * address is the disagreement `ADDRESS_DEFAULT_MISMATCH` exists for — and it refuses precisely
	 * because this call exists and clears both.
	 *
	 * @param id The address whose default is removed.
	 * @param role The role whose default is removed.
	 * @returns The stored address.
	 * @throws BadRequestException `VALIDATION_INVALID_ENUM` when the role has no default.
	 * @throws NotFoundException when the address is not in the caller's scope.
	 */
	async clearDefaultAddress(id: ID, role: AddressRoleEnum): Promise<IAddressBook> {
		const flag = this.mirroredFlag(role);
		const column = this.partyDefaultColumn(role);

		await this.typeOrmAddressRepository.manager.transaction(async (manager: EntityManager) => {
			const address = await this.lockAddress(manager, id);

			if (!address) {
				throw new NotFoundException(`${ApiErrorCode.RESOURCE_NOT_FOUND}: no such address in this organization.`);
			}

			await manager.update(Address, { id: address.id, ...this.scope } as never, { [flag]: false } as never);
			await this.addressRoleService.assign(address.id, role, { isDefault: false }, manager);

			if (address.ownerType === AddressOwnerType.CONTACT && address.customerId && column) {
				// Only the column that names **this** address is cleared. Clearing a sibling's default
				// must never take the party's real default with it, and the column is the authority for
				// exactly one row.
				const party: OrganizationContact | null = await manager.findOne(OrganizationContact, {
					where: { id: address.customerId }
				} as never);
				const authoritative = party ? (party as unknown as Record<string, unknown>)[column] : null;

				if (authoritative && String(authoritative) === String(address.id)) {
					await manager.update(OrganizationContact, { id: address.customerId } as never, {
						[column]: null
					} as never);
				}
			}
		});

		return this.findAddressOrFail(id);
	}

	/**
	 * The default address of one owner for one role — the read behind a checkout and behind the party's
	 * own two references.
	 *
	 * The answer comes from the role rows, and it is checked against the authority before it is
	 * returned: when the owner is a party and both say something, the party's column and the role row
	 * must agree, and two addresses of one owner claiming the role is refused rather than resolved.
	 * There is no rule that says which of two claimants is right, and silently picking one is how two
	 * clients come to disagree while both read the schema correctly.
	 *
	 * @param ownerType What kind of thing the owner is.
	 * @param ownerId The owner's id.
	 * @param role The role to resolve.
	 * @returns The default address, or null when this owner has none for that role.
	 * @throws ApiException `ADDRESS_DEFAULT_MISMATCH` (409) when two addresses claim the role, or when
	 * the party's column and the role row disagree.
	 */
	async findDefaultAddress(ownerType: AddressOwnerType, ownerId: ID, role: AddressRoleEnum): Promise<IAddressBook | null> {
		const book: Address[] = await this.find({
			where: { ownerType, ownerId, ...this.scope }
		} as never);

		if (!book.length) {
			return null;
		}

		const defaultId = await this.addressRoleService.defaultFor(
			role,
			book.map((one) => one.id)
		);

		if (!defaultId) {
			return null;
		}

		const address = book.find((one) => one.id === defaultId) ?? null;

		if (address && ownerType === AddressOwnerType.CONTACT && address.customerId) {
			await this.assertPartyAgrees(address, role, true);
		}

		return address;
	}

	/**
	 * The roles one address plays.
	 *
	 * @param addressId The address id.
	 * @returns The role values.
	 * @throws NotFoundException when the address is not in the caller's scope.
	 */
	async listRoles(addressId: ID): Promise<AddressRoleEnum[]> {
		await this.findAddressOrFail(addressId);

		return this.addressRoleService.rolesOf(addressId);
	}

	/**
	 * Replaces the roles one address plays.
	 *
	 * A role that is no longer stated is revoked and a newly stated one is assigned, so the call means
	 * "these are the roles now" rather than "add these". The mirror rule is enforced on the way in: a
	 * stated default that contradicts the address's own boolean is refused, because the boolean is
	 * written by the default operations and a role write is not a second door into it. Roles without a
	 * default are passed straight to the pivot, which refuses a default on a role nothing reads.
	 *
	 * @param addressId The address id.
	 * @param roles The complete set of roles the address plays.
	 * @returns The stored role rows.
	 * @throws BadRequestException when the pivot refuses a default on a role that has none.
	 * @throws ApiException `ADDRESS_DEFAULT_MISMATCH` (409) when a stated default contradicts the
	 * address's own flag.
	 * @throws NotFoundException when the address is not in the caller's scope.
	 */
	async setRoles(addressId: ID, roles: IAddressRoleAssignment[]): Promise<AddressRole[]> {
		const address = await this.findAddressOrFail(addressId);
		const stated = (Array.isArray(roles) ? roles : []).filter((one) => Boolean(one?.role));

		for (const one of stated) {
			if (one.isDefault !== undefined) {
				this.addressRoleService.assertMirrorsDefault(
					one.role,
					one.isDefault,
					this.isDefaultFor(address, one.role)
				);
			}
		}

		const existing = await this.addressRoleService.rolesOf(addressId);

		for (const role of existing) {
			if (!stated.some((one) => one.role === role)) {
				await this.addressRoleService.revoke(addressId, role);
			}
		}

		for (const one of stated) {
			await this.addressRoleService.assign(addressId, one.role, {
				isDefault: one.isDefault,
				metadata: one.metadata
			});
		}

		return this.addressRoleService.listForAddress(addressId);
	}

	/**
	 * Soft-deletes an address, which is the only removal path there is.
	 *
	 * A hard delete is never offered. An order that was placed with this address keeps its own snapshot,
	 * so removing the row cannot change a historical document — but a saved instrument may still bill
	 * to it, and the role rows beside it describe it, and a row that something points at is not a row to
	 * remove outright. An address that is the party's current default is refused: the party's column
	 * would be left naming a row that is gone, and the caller moves the default first, which is one
	 * call. The address's role rows go with it, because a role of a deleted address is a row nothing
	 * reads.
	 *
	 * @param id The address to soft-delete.
	 * @returns The stored address, carrying the instant it was deleted at.
	 * @throws ApiException `ADDRESS_DEFAULT_MISMATCH` (409) when the party names this address as its
	 * default for either role.
	 * @throws NotFoundException when the address is not in the caller's scope.
	 */
	async softRemoveAddress(id: ID): Promise<IAddressBook> {
		const address = await this.findAddressOrFail(id);

		for (const role of [AddressRoleEnum.SHIPPING, AddressRoleEnum.BILLING]) {
			if (this.isDefaultFor(address, role)) {
				throw new ApiException(
					409,
					ApiErrorCode.ADDRESS_DEFAULT_MISMATCH,
					`This address is the default for ${role}, and a default is moved before it is removed.`,
					{ addressId: id, role }
				);
			}
		}

		for (const role of await this.addressRoleService.rolesOf(id)) {
			await this.addressRoleService.revoke(id, role);
		}

		await this.softDelete(id);

		// The removed row is read back with the deleted ones included: the caller asked for this address
		// and the answer is the row it asked about, not a miss.
		const removed: Address[] = await this.find({ where: { id, ...this.scope }, withDeleted: true } as never);

		return removed.length ? removed[0] : address;
	}

	/**
	 * Reads one address of the caller's organization, answering null when there is none.
	 *
	 * The answering form exists because a caller deciding what to do about a missing address — a
	 * checkout resolving a ship-to, an audit reconciling the book — treats the miss as an ordinary
	 * fact, while {@link findAddressOrFail} is for a caller handed an identifier it must honour.
	 *
	 * @param id The address id.
	 * @returns The address, or null.
	 */
	async findAddress(id: ID): Promise<IAddressBook | null> {
		const addresses: Address[] = await this.find({ where: { id, ...this.scope } } as never);

		return addresses.length ? addresses[0] : null;
	}

	/**
	 * Applies a stated default flag.
	 *
	 * Setting it moves the default; clearing it is refused where the party's own column still names this
	 * address, because that is the disagreement the code exists for — the mirror would read "no" while
	 * the authority reads "this one". Clearing both is the explicit operation
	 * ({@link clearDefaultAddress}), and moving the default is {@link setDefaultAddress}: either is one
	 * call, and neither leaves the two locations saying different things.
	 *
	 * @param id The address.
	 * @param role The role the flag belongs to.
	 * @param isDefault The value the caller stated.
	 * @throws ApiException `ADDRESS_DEFAULT_MISMATCH` (409) when the party names this address.
	 */
	private async applyDefault(id: ID, role: AddressRoleEnum, isDefault: boolean): Promise<void> {
		if (isDefault) {
			await this.setDefaultAddress(id, role);

			return;
		}

		await this.assertDefaultNotAuthoritative(id, role);
		await this.clearDefaultAddress(id, role);
	}

	/**
	 * Refuses a write that would clear a default the party's own column names.
	 *
	 * @param id The address the write names.
	 * @param role The role being cleared.
	 * @throws ApiException `ADDRESS_DEFAULT_MISMATCH` (409).
	 */
	private async assertDefaultNotAuthoritative(id: ID, role: AddressRoleEnum): Promise<void> {
		const address = await this.findAddressOrFail(id);
		const column = this.partyDefaultColumn(role);

		if (!column || address.ownerType !== AddressOwnerType.CONTACT || !address.customerId) {
			return;
		}

		const party: OrganizationContact | null = await this.typeOrmAddressRepository.manager.findOne(
			OrganizationContact,
			{ where: { id: address.customerId } } as never
		);
		const authoritative = party ? (party as unknown as Record<string, unknown>)[column] : null;

		if (authoritative && String(authoritative) === String(id)) {
			throw new ApiException(
				409,
				ApiErrorCode.ADDRESS_DEFAULT_MISMATCH,
				`The default address of this party is ${String(authoritative)}, and the write named ${String(
					id
				)} to be cleared.`,
				{ customerId: address.customerId, role, authoritative, requested: id }
			);
		}
	}

	/**
	 * Refuses a body that states a validation verdict.
	 *
	 * @param stated The body as the caller sent it.
	 * @throws BadRequestException `VALIDATION_UNKNOWN_FIELD`.
	 */
	private assertNoValidationVerdict(stated: Record<string, unknown>): void {
		for (const member of AddressService.VALIDATION_MEMBERS) {
			if (stated[member] !== undefined && stated[member] !== null) {
				throw new BadRequestException(
					`${ApiErrorCode.VALIDATION_UNKNOWN_FIELD}: '${member}' is the address-validation strategy's verdict and is written by the operation that observes it.`
				);
			}
		}
	}

	/**
	 * Refuses an owner type the vocabulary does not hold.
	 *
	 * @param ownerType The stated kind of owner.
	 * @throws BadRequestException `VALIDATION_INVALID_ENUM`.
	 */
	private assertOwnerType(ownerType: AddressOwnerType): void {
		if (!Object.values(AddressOwnerType).includes(ownerType)) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_INVALID_ENUM}: '${String(ownerType)}' is not a kind of thing an address belongs to.`
			);
		}
	}

	/**
	 * Refuses an owner pair and a buyer reference that disagree.
	 *
	 * The rule is read in both directions, because both are real writes. A contact address whose
	 * `customerId` names a different row than `ownerId` is two answers to "whose address is this"; an
	 * address owned by a warehouse, a seller, a supplier or the organization itself carries no buyer
	 * reference at all, because its owner is not a party. The case that is **not** refused is the
	 * anonymous cart address: a contact address with no `customerId` is the guest row the table
	 * describes, and the nightly audit reports it rather than this service inventing a party.
	 *
	 * @param ownerType What kind of thing the owner is.
	 * @param ownerId The owner's id.
	 * @param customerId The stated buyer reference, when one is stated.
	 * @throws BadRequestException `VALIDATION_REQUIRED_FIELD` when the owner id is missing.
	 * @throws ApiException `ADDRESS_OWNER_MISMATCH` (409) when the two disagree.
	 */
	private assertOwnerConsistency(ownerType: AddressOwnerType, ownerId: ID, customerId?: ID | null): void {
		if (!this.isStated(ownerId)) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_REQUIRED_FIELD}: an address belongs to something, and the owner's id is what names it.`
			);
		}

		if (ownerType === AddressOwnerType.CONTACT) {
			if (this.isStated(customerId) && String(customerId) !== String(ownerId)) {
				throw new ApiException(
					409,
					ApiErrorCode.ADDRESS_OWNER_MISMATCH,
					`This address is owned by ${ownerType} but references customer ${String(customerId)}.`,
					{ ownerType, ownerId, customerId }
				);
			}

			return;
		}

		if (this.isStated(customerId)) {
			throw new ApiException(
				409,
				ApiErrorCode.ADDRESS_OWNER_MISMATCH,
				`This address is owned by ${ownerType} but references customer ${String(customerId)}.`,
				{ ownerType, ownerId, customerId }
			);
		}
	}

	/**
	 * Normalises and validates a country code.
	 *
	 * @param countryCode The code as stated.
	 * @returns The upper-case two-letter code.
	 * @throws BadRequestException `VALIDATION_FAILED` when it is not two letters.
	 */
	private normaliseCountryCode(countryCode?: string): string {
		const normalised = String(countryCode ?? '')
			.trim()
			.toUpperCase();

		if (!/^[A-Z]{2}$/.test(normalised)) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_FAILED}: a country is stated as its ISO 3166-1 alpha-2 code, and '${String(
					countryCode
				)}' is not one.`
			);
		}

		return normalised;
	}

	/**
	 * Resolves the country lookup row the stated code names.
	 *
	 * The resolution is the only writer of `countryId`: the invariant is that the column is filled when
	 * and only when the code matches a country row, and a body that states the two independently can
	 * only ever disagree. A stated id that the resolution confirms is accepted, one it contradicts is
	 * refused, and a code the lookup does not contain clears the column — which is a real destination
	 * the platform's reference list simply does not carry.
	 *
	 * @param manager The transaction or connection manager.
	 * @param countryCode The normalised country code.
	 * @param statedCountryId The id the caller stated, when it stated one.
	 * @returns The resolved country id, or null when the code matches nothing.
	 * @throws BadRequestException `VALIDATION_FAILED` when a stated id contradicts the resolution.
	 */
	private async resolveCountryId(
		manager: EntityManager,
		countryCode: string,
		statedCountryId?: ID
	): Promise<ID | null> {
		const match: Country | null = await manager.findOne(Country, { where: { isoCode: countryCode } } as never);
		const resolved = match?.id ?? null;

		if (this.isStated(statedCountryId) && String(statedCountryId) !== String(resolved)) {
			throw new BadRequestException(
				`${ApiErrorCode.VALIDATION_FAILED}: 'countryId' is resolved from the country code, and the stated row is not the one '${countryCode}' names.`
			);
		}

		return resolved;
	}

	/**
	 * The descriptive members of a body, copied as stated.
	 *
	 * @param stated The body as the caller sent it.
	 * @returns The members that are stored verbatim.
	 */
	private descriptive(stated: Record<string, unknown>): Record<string, unknown> {
		const out: Record<string, unknown> = {};

		for (const member of AddressService.DESCRIPTIVE_MEMBERS) {
			if (stated[member] !== undefined) {
				out[member] = stated[member];
			}
		}

		return out;
	}

	/**
	 * Whether a value is present at all — a null or a blank string is an absence, not a value.
	 *
	 * @param value The value to test.
	 * @returns True when something was stated.
	 */
	private isStated(value: unknown): boolean {
		return value !== undefined && value !== null && String(value).trim().length > 0;
	}

	/**
	 * The boolean an address's role mirrors, and the refusal for a role that has none.
	 *
	 * @param role The role.
	 * @returns The column name of its mirror.
	 * @throws BadRequestException `VALIDATION_INVALID_ENUM` when the role has no default.
	 */
	private mirroredFlag(role: AddressRoleEnum): 'isDefaultShipping' | 'isDefaultBilling' {
		if (role === AddressRoleEnum.SHIPPING) {
			return 'isDefaultShipping';
		}

		if (role === AddressRoleEnum.BILLING) {
			return 'isDefaultBilling';
		}

		throw new BadRequestException(
			`${ApiErrorCode.VALIDATION_INVALID_ENUM}: ${String(role)} has no default; only ${AddressRoleEnum.SHIPPING} and ${AddressRoleEnum.BILLING} do.`
		);
	}

	/**
	 * The party column a role's default is authoritative on.
	 *
	 * @param role The role.
	 * @returns The column name, or null for a role with no mirror.
	 */
	private partyDefaultColumn(role: AddressRoleEnum): 'defaultShippingAddressId' | 'defaultBillingAddressId' | null {
		if (role === AddressRoleEnum.SHIPPING) {
			return 'defaultShippingAddressId';
		}

		if (role === AddressRoleEnum.BILLING) {
			return 'defaultBillingAddressId';
		}

		return null;
	}

	/**
	 * Whether an address carries the default for one role.
	 *
	 * @param address The address to read.
	 * @param role The role.
	 * @returns True when the address's own boolean says it is the default.
	 */
	private isDefaultFor(address: IAddressBook, role: AddressRoleEnum): boolean {
		if (role === AddressRoleEnum.SHIPPING) {
			return Boolean(address.isDefaultShipping);
		}

		if (role === AddressRoleEnum.BILLING) {
			return Boolean(address.isDefaultBilling);
		}

		return false;
	}

	/**
	 * The live addresses that share an owner with the one given — the book a default is decided inside.
	 *
	 * A party's book is keyed by the buyer reference, because that is the tuple the partial unique
	 * index constrains and the scope a checkout means by "the customer's addresses". An address whose
	 * owner is not a party has no buyer reference, so its book is the owner pair itself.
	 *
	 * @param manager The transaction manager.
	 * @param address The address whose book is read.
	 * @returns The owner's live addresses, this one included.
	 */
	private async ownerBook(manager: EntityManager, address: Address): Promise<Address[]> {
		const owner = address.customerId
			? { customerId: address.customerId }
			: { ownerType: address.ownerType, ownerId: address.ownerId };

		return manager.find(Address, { where: { ...owner, ...this.scope } } as never);
	}

	/**
	 * Writes the party's authoritative default reference, in the caller's transaction.
	 *
	 * Only a contact address that names a party has an authoritative column to write: a warehouse,
	 * seller, supplier or organization address has no party row, and the role rows are then the only
	 * place its default lives. The write is what makes the two locations one fact rather than two.
	 *
	 * @param manager The transaction manager.
	 * @param address The address becoming the default.
	 * @param role The role it becomes the default for.
	 * @param addressId The id the party's column is set to.
	 */
	private async writePartyDefault(
		manager: EntityManager,
		address: Address,
		role: AddressRoleEnum,
		addressId: ID
	): Promise<void> {
		const column = this.partyDefaultColumn(role);

		if (!column || address.ownerType !== AddressOwnerType.CONTACT || !address.customerId) {
			return;
		}

		await manager.update(OrganizationContact, { id: address.customerId } as never, {
			[column]: addressId
		} as never);
	}

	/**
	 * Refuses a role answer the party's own column contradicts.
	 *
	 * @param address The address being returned as the default.
	 * @param role The role it is the default for.
	 * @param roleIsDefault The role row's flag.
	 * @throws ApiException `ADDRESS_DEFAULT_MISMATCH` (409) when the two disagree.
	 */
	private async assertPartyAgrees(address: Address, role: AddressRoleEnum, roleIsDefault: boolean): Promise<void> {
		const column = this.partyDefaultColumn(role);

		if (!column || !address.customerId) {
			return;
		}

		const party: OrganizationContact | null = await this.typeOrmAddressRepository.manager.findOne(
			OrganizationContact,
			{ where: { id: address.customerId } } as never
		);

		if (!party) {
			return;
		}

		const authoritative = (party as unknown as Record<string, unknown>)[column];
		const agrees = this.isStated(authoritative) ? String(authoritative) === String(address.id) : !roleIsDefault;

		if (!agrees) {
			throw new ApiException(
				409,
				ApiErrorCode.ADDRESS_DEFAULT_MISMATCH,
				`The default address of this party is ${String(authoritative)}, and the ${role} role names ${String(
					address.id
				)}.`,
				{ customerId: address.customerId, role, authoritative, requested: address.id }
			);
		}
	}

	/**
	 * Reads the address under a lock where the dialect supports one.
	 *
	 * The default rule is decided from the address's owner and from its siblings' current flags, so the
	 * row is held for the decision rather than read and written around. The embedded dialect serializes
	 * writers on its own, so there the surrounding transaction is the lock and no statement is added.
	 *
	 * @param manager The transaction manager.
	 * @param id The address to lock.
	 * @returns The locked address, or null when it does not exist.
	 */
	private async lockAddress(manager: EntityManager, id: ID): Promise<Address | null> {
		const query = manager.createQueryBuilder(Address, 'address').where({ id, ...this.scope });

		if (isPostgres() || isMySQL()) {
			// `pessimistic_write` maps to FOR UPDATE on both dialects.
			return query.setLock('pessimistic_write').getOne();
		}

		return query.getOne();
	}
}

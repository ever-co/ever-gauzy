import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ID, IAddressBook, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { paginateRows, resolveRestPage } from '../api/graphql-connection';
import { CrudController } from '../core/crud';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { AddressRoleService } from '../address-role/address-role.service';
import { Address } from './address.entity';
import { AddressService } from './address.service';
import {
	AddressQueryDTO,
	CreateAddressDTO,
	ReplaceAddressRolesDTO,
	SetAddressDefaultDTO,
	UpdateAddressDTO
} from './dto';

/**
 * One role an address plays, as this controller answers it.
 *
 * The shape is the endpoint table's own (`role`, `isDefault`) rather than the pivot's row, because
 * what a caller decides with is the set and which member of it is the default — the row's id and its
 * metadata are the role domain's business and are reachable there.
 */
export interface IAddressRoleRead {
	/** The role the address plays. */
	readonly role: string;
	/** Whether it is the default for that role within the owner's book. */
	readonly isDefault: boolean;
}

/**
 * The address book over REST.
 *
 * **The addresses of a party, a location or the organization itself**, with the roles each one plays
 * and the two defaults it may carry. Every rule the resource has is the service's, and this class adds
 * exactly three things to it: the permissions each route carries, the validation of the bodies those
 * routes accept, and the list envelope.
 *
 * **The defaults are moved, never written.** A body that states `isDefaultShipping` or
 * `isDefaultBilling` is routed by `AddressService` to `setDefaultAddress` or to
 * `clearDefaultAddress`, and the dedicated routes below call those two operations directly — so the
 * party's authoritative column, the address's own mirror boolean and the role row move together
 * whichever door the caller came through, and no route in this class writes a default flag itself.
 * That is also why `DELETE /:id/soft` is overridden rather than inherited: the base class's soft
 * remove would delete a row the party still names as its default, which is the one removal the service
 * refuses.
 *
 * **The role routes are the address's own.** §7.5a hangs them off the address because a role is a
 * dimension of one address row rather than a resource of its own; the role *domain* keeps its own
 * surface at `/address-roles` for the operations that are not about one address. The read answers
 * through the pivot service rather than through `AddressService.listRoles`, because the table's
 * response carries `isDefault` and `listRoles` answers the role values alone — the pivot is the same
 * service the address module already imports for the default rule, so this is not a second reading
 * path, it is the one the fact lives in.
 *
 * **The contact-token half of the permission column cannot be implemented.** The endpoint table
 * writes `ORG_CONTACT_VIEW / Contact token` and `ORG_CONTACT_EDIT / Contact token` for this resource,
 * and there is no contact subject in `RequestContext` and no decorator that establishes one: a
 * contact credential authenticates a shopper, not a member of staff, and nothing in the platform
 * turns one into a request context. Inventing that path is out of scope for a resource surface, so
 * every route here is guarded on the staff permission the same row names, and a storefront that needs
 * to read its own addresses must do so through a surface that owns a contact subject.
 *
 * **Every inherited CRUD route this class overrides restates its own route decorator.** An override
 * replaces the property, so a dropped decorator is an endpoint that quietly stops existing — and
 * `create` and `update` are declared here rather than inherited because a body is validated from the
 * type the handler names, which the base class's generic is not.
 *
 * Two rows of the endpoint table are deliberately not delivered, and both are reported rather than
 * faked: `POST /addresses/:id/validate` needs the address-validation strategy the kernel does not
 * ship (the service writes `isValidated` from the operation that asks a validator, and no such
 * operation exists here), so the route would have to answer a verdict it never obtained. What *is*
 * added beyond the table is the default pair — `POST /:id/set-default` and `POST /:id/clear-default` —
 * because the GraphQL surface names `setDefaultAddress` and capability parity requires a REST route
 * for it, and because clearing a default is the one state the descriptive `PUT` refuses to reach by
 * design.
 */
@ApiTags('Address')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
@Controller('/addresses')
export class AddressController extends CrudController<Address> {
	constructor(
		private readonly addressService: AddressService,
		private readonly addressRoleService: AddressRoleService
	) {
		super(addressService);
	}

	/**
	 * Lists the addresses of the caller's organization, newest first.
	 *
	 * @param query The narrowing and the page to read.
	 * @returns One page of addresses.
	 */
	@ApiOperation({ summary: 'List addresses' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Addresses retrieved' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'QUERY_PAGE_LIMIT_EXCEEDED' })
	@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query?: AddressQueryDTO): Promise<IPagination<IAddressBook>> {
		const rows = await this.addressService.listAddresses(this.narrowing(query));
		const { take, skip } = resolveRestPage(query?.take, query?.skip);

		return paginateRows(rows, take, skip);
	}

	/**
	 * Reads one address.
	 *
	 * @param id The address to read.
	 * @returns The address.
	 */
	@ApiOperation({ summary: 'Find an address by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Address retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
	@Get(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IAddressBook> {
		return this.addressService.findAddressOrFail(id);
	}

	/**
	 * Records an address.
	 *
	 * @param entity The address as the caller states it.
	 * @returns The stored address, with the defaults it asked for already moved.
	 */
	@ApiOperation({ summary: 'Create an address' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Address created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'VALIDATION_REQUIRED_FIELD, VALIDATION_FAILED' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'ADDRESS_OWNER_MISMATCH' })
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateAddressDTO): Promise<IAddressBook> {
		return this.addressService.createAddress(entity);
	}

	/**
	 * Changes the descriptive facts of an address.
	 *
	 * A stated default is not written here: `AddressService.updateAddress` routes it to the move or to
	 * the clear, so the two locations of one fact cannot be left disagreeing by this route.
	 *
	 * @param id The address to change.
	 * @param entity The facts to change.
	 * @returns The stored address.
	 */
	@ApiOperation({ summary: 'Update an address' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Address updated' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'VALIDATION_REQUIRED_FIELD, VALIDATION_FAILED' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'ADDRESS_OWNER_MISMATCH, ADDRESS_DEFAULT_MISMATCH' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@HttpCode(HttpStatus.OK)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateAddressDTO): Promise<IAddressBook> {
		return this.addressService.updateAddress(id, entity);
	}

	/**
	 * Removes an address, softly, which is the only removal the book offers.
	 *
	 * An address the party names as its current default is refused with `ADDRESS_DEFAULT_MISMATCH`: the
	 * caller moves the default first, which is one call and keeps the party's column and the address's
	 * mirror in step. The row itself is kept — a saved instrument may still bill to it, and an order
	 * that was placed with it carries its own snapshot.
	 *
	 * @param id The address to remove.
	 * @returns The stored address, carrying the instant it was deleted at.
	 */
	@ApiOperation({ summary: 'Remove an address' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Address removed' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'ADDRESS_DEFAULT_MISMATCH' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@HttpCode(HttpStatus.OK)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<IAddressBook> {
		return this.addressService.softRemoveAddress(id);
	}

	/**
	 * Removes an address through the soft-delete route the CRUD base maps.
	 *
	 * The route is restated and routed to the domain's own removal, deliberately: the inherited
	 * implementation soft-deletes the row directly and would therefore delete an address the party
	 * still names as its default — the state `softRemoveAddress` exists to refuse.
	 *
	 * @param id The address to remove.
	 * @returns The stored address, soft-deleted.
	 */
	@ApiOperation({ summary: 'Soft delete an address' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Address removed' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'ADDRESS_DEFAULT_MISMATCH' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@HttpCode(HttpStatus.OK)
	@Delete(':id/soft')
	async softRemove(@Param('id', UUIDValidationPipe) id: ID): Promise<IAddressBook> {
		return this.addressService.softRemoveAddress(id);
	}

	/**
	 * Reads the roles an address plays and which of them it is the default for.
	 *
	 * @param id The address to read.
	 * @returns The role rows of the address, as `role` and `isDefault`.
	 */
	@ApiOperation({ summary: 'Read the roles an address plays' })
	@ApiResponse({ status: HttpStatus.OK, description: 'The role rows of the address' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
	@Get(':id/roles')
	async findRoles(@Param('id', UUIDValidationPipe) id: ID): Promise<IAddressRoleRead[]> {
		await this.addressService.findAddressOrFail(id);

		return (await this.addressRoleService.listForAddress(id)).map((row) => ({
			role: row.role,
			isDefault: Boolean(row.isDefault)
		}));
	}

	/**
	 * Replaces the roles an address plays.
	 *
	 * The call means "these are the roles now": a role the body leaves out is revoked and a newly
	 * stated one is assigned. A stated default that contradicts the address's own mirror boolean is
	 * refused by the service rather than written, because the boolean is moved by the default
	 * operations and a role write is not a second door into it.
	 *
	 * @param id The address whose role set is replaced.
	 * @param entity The roles the address plays afterwards.
	 * @returns The stored role rows, as `role` and `isDefault`.
	 */
	@ApiOperation({ summary: "Replace an address's roles" })
	@ApiResponse({ status: HttpStatus.OK, description: 'Roles replaced' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'ADDRESS_ROLE_DEFAULT_UNSUPPORTED' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'ADDRESS_DEFAULT_MISMATCH' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@HttpCode(HttpStatus.OK)
	@Put(':id/roles')
	@UseValidationPipe({ transform: true, whitelist: true })
	async replaceRoles(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: ReplaceAddressRolesDTO
	): Promise<IAddressRoleRead[]> {
		const stored = await this.addressService.setRoles(
			id,
			(entity?.roles ?? []).map((one) => ({
				role: one.role,
				isDefault: one.isDefault,
				metadata: one.metadata as Record<string, unknown>
			}))
		);

		return stored.map((row) => ({ role: row.role, isDefault: Boolean(row.isDefault) }));
	}

	/**
	 * Makes an address the party's default for one role, in one transaction.
	 *
	 * @param id The address to make the default.
	 * @param entity The role it becomes the default for.
	 * @returns The stored address.
	 */
	@ApiOperation({ summary: 'Mark an address as the default for a role' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Default address changed' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'VALIDATION_INVALID_ENUM' })
	@ApiResponse({ status: HttpStatus.CONFLICT, description: 'ADDRESS_DEFAULT_MISMATCH' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@HttpCode(HttpStatus.OK)
	@Post(':id/set-default')
	@UseValidationPipe({ transform: true, whitelist: true })
	async setDefault(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: SetAddressDefaultDTO): Promise<IAddressBook> {
		return this.addressService.setDefaultAddress(id, entity.role);
	}

	/**
	 * Removes the default from one role, wherever it currently sits.
	 *
	 * A party is allowed to have no default address at all, and this is the only call that reaches
	 * that state without leaving the party's column and the address's mirror saying different things —
	 * which is exactly why the descriptive `PUT` refuses the same request.
	 *
	 * @param id The address whose default is removed.
	 * @param entity The role whose default is removed.
	 * @returns The stored address.
	 */
	@ApiOperation({ summary: 'Clear the default of a role' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Default address cleared' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'VALIDATION_INVALID_ENUM' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'RESOURCE_NOT_FOUND' })
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	@HttpCode(HttpStatus.OK)
	@Post(':id/clear-default')
	@UseValidationPipe({ transform: true, whitelist: true })
	async clearDefault(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: SetAddressDefaultDTO
	): Promise<IAddressBook> {
		return this.addressService.clearDefaultAddress(id, entity.role);
	}

	/**
	 * The equality members of the list query, from whichever spelling stated them.
	 *
	 * Members that were not stated are left out rather than written as `undefined`, because a
	 * repository handed an explicit `undefined` asks the database for a row whose column *is* null —
	 * a different question from "do not narrow on this column". The three boolean members are kept
	 * when they are stated, because `false` is a question rather than an absence.
	 *
	 * @param query The query as stated.
	 * @returns The narrowing to hand the read.
	 */
	private narrowing(query?: AddressQueryDTO): Parameters<AddressService['listAddresses']>[0] {
		const stated: Record<string, unknown> = {};

		for (const member of [
			'customerId',
			'countryCode',
			'ownerType',
			'ownerId',
			'isDefaultShipping',
			'isDefaultBilling',
			'isValidated'
		] as const) {
			const value = query?.[member] ?? query?.filter?.[member];

			if (value !== undefined && value !== null) {
				stated[member] = value;
			}
		}

		return stated as Parameters<AddressService['listAddresses']>[0];
	}
}

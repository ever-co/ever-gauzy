import {
	Body,
	BadRequestException,
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
import { ContactGroupType, IContactGroup, ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { paginateRows, resolveRestPage } from '../api/graphql-connection';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { CrudController } from '../core/crud';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ContactGroup } from './contact-group.entity';
import { ContactGroupService } from './contact-group.service';
import { ContactGroupQueryDTO, CreateContactGroupDTO, UpdateContactGroupDTO } from './dto';

/**
 * Contact groups over REST.
 *
 * **A group is a set prices and promotions can target**, so this resource is the segmentation root:
 * the membership that decides who is in it is served at `/contact-groups/:id/members`, and the rules
 * a rule-based group computes its membership from are the rule kernel's. Every rule the resource has
 * is the service's, and this class adds exactly three things to it: the permissions each route
 * carries, the validation of the bodies those routes accept, and the list envelope.
 *
 * **The permission of each write is the one the permission catalogue assigns to the operation**, not
 * the single edit permission the endpoint table prints for all three. Appendix B separates creating a
 * group (`CONTACT_GROUPS_CREATE`) from changing one and its membership (`CONTACT_GROUPS_EDIT`) from
 * removing a non-system one (`CONTACT_GROUPS_DELETE`), and the three values exist in the platform's
 * catalogue precisely so an archetype can hold one without the others. Where the two documents
 * disagree the catalogue wins, because it is the document that says which permission guards which
 * operation.
 *
 * **Removal is soft, and it is refused for a group the platform maintains.** `DELETE` routes, under
 * both spellings the CRUD base maps, to the service's own removal — the inherited soft delete would
 * remove a system group, which is the one removal the domain refuses.
 *
 * **Three capabilities of the endpoint table are deliberately not delivered, and are reported rather
 * than faked.**
 *
 * - `expand=rules,members` is refused with `QUERY_EXPAND_NOT_ALLOWED`. The membership pivot lives in
 *   `ContactGroupMemberModule`, which imports this module, so injecting its service here would close a
 *   module cycle; and the rule rows a segment's predicate lives in have no GraphQL type in the schema
 *   at all (`Rule` is declared by no SDL document, and declaring it here would turn the rule kernel's
 *   own domain into a collision), so an expansion that REST could answer and GraphQL could not is a
 *   capability the parity doctrine forbids.
 * - `memberCount` on the group detail is the membership service's answer, and it is *not* a row count:
 *   a membership whose window has closed is absent to every reader, so a raw `COUNT` would report
 *   members the platform does not have. The count is therefore answered where the pivot is — the
 *   membership routes carry it, and GraphQL resolves it on `ContactGroup.memberCount`.
 * - `POST /contact-groups/:id/preview` evaluates a rule-based group's membership without saving it,
 *   which needs the segment evaluation the delivered kernel does not ship: the rule kernel evaluates
 *   rule rows against a supplied context, and nothing turns "every party of this organization" into
 *   that context. A preview route would have to invent the answer.
 *
 * **`updateGroup`'s member count is passed as the method's own default.** The service refuses turning
 * a static group into a rule-based one while hand-written member rows exist, and takes that count from
 * its caller because it does not import the membership service. The module boundary above is the same
 * one that blocks `expand=members`, so this route cannot resolve the count and the refusal does not
 * fire from here; it remains in force for the segment materialiser, which owns the count. This is
 * reported rather than worked around, because the alternative is reading the pivot's table from a
 * module that does not own it — and re-implementing the "an expired row is absent" rule to do it.
 *
 * **Every inherited CRUD route this class overrides restates its own route decorator**, and `create`
 * and `update` are declared here rather than inherited because a body is validated from the type the
 * handler names, which the base class's generic is not.
 */
@ApiTags('ContactGroup')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CONTACT_GROUPS_VIEW)
@Controller('/contact-groups')
export class ContactGroupController extends CrudController<ContactGroup> {
	constructor(private readonly contactGroupService: ContactGroupService) {
		super(contactGroupService);
	}

	/**
	 * Lists the groups of the caller's organization, newest first.
	 *
	 * @param query The narrowing and the page to read.
	 * @returns One page of groups.
	 */
	@ApiOperation({ summary: 'List contact groups' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Contact groups retrieved' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'QUERY_EXPAND_NOT_ALLOWED, QUERY_PAGE_LIMIT_EXCEEDED' })
	@Permissions(PermissionsEnum.CONTACT_GROUPS_VIEW)
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query?: ContactGroupQueryDTO): Promise<IPagination<IContactGroup>> {
		this.assertNoExpansion(query);

		const rows = await this.contactGroupService.listGroups(this.narrowing(query));
		const { take, skip } = resolveRestPage(query?.take, query?.skip);

		return paginateRows(rows, take, skip);
	}

	/**
	 * Reads one group.
	 *
	 * @param id The group to read.
	 * @returns The group.
	 */
	@ApiOperation({ summary: 'Find a contact group by id' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Contact group retrieved' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'CONTACT_GROUP_NOT_FOUND' })
	@Permissions(PermissionsEnum.CONTACT_GROUPS_VIEW)
	@Get(':id')
	async findById(@Param('id', UUIDValidationPipe) id: ID): Promise<IContactGroup> {
		return this.contactGroupService.findGroupOrFail(id);
	}

	/**
	 * Creates a group an operator maintains.
	 *
	 * @param entity The group as the caller states it.
	 * @returns The stored group.
	 */
	@ApiOperation({ summary: 'Create a contact group' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Contact group created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'CONTACT_GROUP_INVALID, CONTACT_GROUP_CODE_TAKEN' })
	@Permissions(PermissionsEnum.CONTACT_GROUPS_CREATE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true })
	async create(@Body() entity: CreateContactGroupDTO): Promise<IContactGroup> {
		return this.contactGroupService.createGroup(entity);
	}

	/**
	 * Changes a group's descriptive facts, and its kind.
	 *
	 * @param id The group to change.
	 * @param entity The facts to change.
	 * @returns The stored group.
	 */
	@ApiOperation({ summary: 'Update a contact group' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Contact group updated' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'CONTACT_GROUP_SYSTEM, CONTACT_GROUP_CODE_TAKEN' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'CONTACT_GROUP_NOT_FOUND' })
	@Permissions(PermissionsEnum.CONTACT_GROUPS_EDIT)
	@HttpCode(HttpStatus.OK)
	@Put(':id')
	@UseValidationPipe({ transform: true, whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateContactGroupDTO): Promise<IContactGroup> {
		return this.contactGroupService.updateGroup(id, entity);
	}

	/**
	 * Soft-deletes a group, which is the only removal path there is.
	 *
	 * @param id The group to remove.
	 * @returns The stored group, soft-deleted.
	 */
	@ApiOperation({ summary: 'Delete a contact group' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Contact group removed' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'CONTACT_GROUP_SYSTEM' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'CONTACT_GROUP_NOT_FOUND' })
	@Permissions(PermissionsEnum.CONTACT_GROUPS_DELETE)
	@HttpCode(HttpStatus.OK)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<IContactGroup> {
		return this.contactGroupService.removeGroup(id);
	}

	/**
	 * Removes a group through the soft-delete route the CRUD base maps.
	 *
	 * The route is restated and routed to the domain's own removal, deliberately: the inherited
	 * implementation soft-deletes the row directly and would therefore remove a group the platform
	 * maintains — the one removal `removeGroup` refuses.
	 *
	 * @param id The group to remove.
	 * @returns The stored group, soft-deleted.
	 */
	@ApiOperation({ summary: 'Soft delete a contact group' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Contact group removed' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'CONTACT_GROUP_SYSTEM' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'CONTACT_GROUP_NOT_FOUND' })
	@Permissions(PermissionsEnum.CONTACT_GROUPS_DELETE)
	@HttpCode(HttpStatus.OK)
	@Delete(':id/soft')
	async softRemove(@Param('id', UUIDValidationPipe) id: ID): Promise<IContactGroup> {
		return this.contactGroupService.removeGroup(id);
	}

	/**
	 * Puts a withdrawn group back, through the recovery route the CRUD base maps.
	 *
	 * The route is restated only to state its own permission. Left inherited, it carried none, and
	 * `PermissionGuard` — which resolves handler-then-class — authorised it on this class's read grant
	 * (`CONTACT_GROUPS_VIEW`), so a role that may only look at the groups could undo a removal made under
	 * `CONTACT_GROUPS_DELETE`. Restoring undoes a removal, so it states the grant the two removals above
	 * state, which is what the plugin controllers state on theirs. The status code and the service
	 * method are the inherited route's own, so the change is who may call it and nothing else.
	 *
	 * @param id The group to restore.
	 * @returns The stored group, no longer deleted.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted contact group' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Contact group restored' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@Permissions(PermissionsEnum.CONTACT_GROUPS_DELETE)
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id/recover')
	async softRecover(@Param('id', UUIDValidationPipe) id: ID): Promise<ContactGroup> {
		return this.contactGroupService.softRecover(id);
	}

	/**
	 * Refuses an expansion this resource does not offer.
	 *
	 * The refusal is the query protocol's own code for an expansion outside the resource's allow-list,
	 * and the message names each relation the endpoint table asks for so a client learns why rather than
	 * which parameter to drop.
	 *
	 * @param query The query as stated.
	 * @throws BadRequestException `QUERY_EXPAND_NOT_ALLOWED` when anything was asked to be expanded.
	 */
	private assertNoExpansion(query?: ContactGroupQueryDTO): void {
		const wanted = query?.expand ?? [];

		if (wanted.length === 0) {
			return;
		}

		throw new BadRequestException(
			`${ApiErrorCode.QUERY_EXPAND_NOT_ALLOWED}: this resource offers no expansion. 'members' belongs to ` +
				'the membership pivot, which is served at /contact-groups/:id/members, and ' +
				"'rules' is the rule kernel's, which no document of the composed schema declares a type for."
		);
	}

	/**
	 * The equality members of the list query, from whichever spelling stated them.
	 *
	 * `q` and `search` are the two spellings of the free-text narrowing; the table uses the first for
	 * the sibling contact resources and the delivered list method names the second. Members that were
	 * not stated are left out rather than written as `undefined`, and `isSystem` is kept when it is
	 * stated because `false` is a question rather than an absence.
	 *
	 * @param query The query as stated.
	 * @returns The narrowing to hand the read.
	 */
	private narrowing(query?: ContactGroupQueryDTO): {
		type?: ContactGroupType;
		priceListId?: ID;
		isSystem?: boolean;
		search?: string;
	} {
		const stated: { type?: ContactGroupType; priceListId?: ID; isSystem?: boolean; search?: string } = {};

		for (const member of ['type', 'priceListId', 'isSystem'] as const) {
			const value = query?.[member] ?? query?.filter?.[member];

			if (value !== undefined && value !== null) {
				stated[member] = value as never;
			}
		}

		const search = query?.search ?? query?.filter?.search ?? query?.q;

		if (search !== undefined && search !== null) {
			stated.search = search;
		}

		return stated;
	}
}

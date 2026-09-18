import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ContactGroupType, IContactGroup, ID as Id, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { ContactGroupService } from './contact-group.service';

/**
 * The members `CreateContactGroupInput` declares in the schema.
 *
 * `isSystem` is absent by construction: the flag is what makes a group undeletable and un-recordable,
 * so it is written by the platform's own seeding path and never by a request.
 */
export interface ICreateContactGroupInput {
	organizationId: Id;
	name: string;
	code: string;
	description?: string;
	type?: ContactGroupType;
	priceListId?: Id;
	discountPercent?: number;
	metadata?: Record<string, unknown>;
}

/**
 * The members `UpdateContactGroupInput` declares in the schema.
 */
export interface IUpdateContactGroupInput extends Partial<ICreateContactGroupInput> {
	id: Id;
}

/**
 * The fields a group list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ContactGroupFilter` and `ContactGroupSortField`
 * are its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 */
const CONTACT_GROUP_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	code: 'STRING',
	description: 'STRING',
	type: 'ENUM',
	priceListId: 'ID',
	isSystem: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const CONTACT_GROUP_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'code',
	'type',
	'isSystem',
	'discountPercent'
] as const;

/**
 * The order the delivered list method means: newest first. The connection reproduces it rather than
 * replacing it, so the REST answer and this one list the same rows in the same order when neither
 * caller states a sort.
 */
const CONTACT_GROUP_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * Contact groups over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `ContactGroupService` the `/api/contact-groups` routes
 * call, under the same guard chain and the same permission. A client that reaches a capability over one
 * protocol is not given a narrower or a wider one than the client that reaches it over the other.
 *
 * **The list root field is a connection, not a bare array.** The same `filter`, `sort` and page the
 * REST route accepts, answered with the platform's own cursor codec, so a cursor obtained over REST
 * resumes here — and the same refusal codes, so a client that branches on `QUERY_SORT_NOT_ALLOWED` over
 * one surface branches on it over the other.
 *
 * **The membership of a group is not a field of this type.** Who is in a group is the pivot's answer,
 * and the pivot lives in `ContactGroupMemberModule`, which imports this module — so the field resolver
 * that answers `members` and `memberCount` is declared there, beside the service that owns the fact,
 * and a raw row count is deliberately not used in its place: a membership whose window has closed is
 * absent to every reader.
 *
 * **`withDeleted` is deliberately absent.** It is a repository option the delivered list methods do not
 * expose, and offering an argument that cannot be honoured would be worse than not offering it.
 */
@Resolver('ContactGroup')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CONTACT_GROUPS_VIEW)
export class ContactGroupResolver {
	constructor(private readonly contactGroupService: ContactGroupService) {}

	/**
	 * The groups of the caller's organization, newest first.
	 */
	@Query('contactGroups')
	@Permissions(PermissionsEnum.CONTACT_GROUPS_VIEW)
	async contactGroups(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IContactGroup>> {
		const rows = await this.contactGroupService.listGroups();

		return buildConnection<IContactGroup>({
			rows,
			filterable: CONTACT_GROUP_FILTERABLE,
			sortable: CONTACT_GROUP_SORTABLE,
			defaultSort: CONTACT_GROUP_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One group of the caller's organization, or `null` when there is none.
	 */
	@Query('contactGroup')
	@Permissions(PermissionsEnum.CONTACT_GROUPS_VIEW)
	async contactGroup(@Args('id', { type: () => ID }) id: Id): Promise<IContactGroup | null> {
		return this.contactGroupService.findGroup(id);
	}

	/**
	 * Creates a group an operator maintains.
	 */
	@Mutation('createContactGroup')
	@Permissions(PermissionsEnum.CONTACT_GROUPS_CREATE)
	async createContactGroup(@Args('input') input: ICreateContactGroupInput): Promise<IContactGroup> {
		return this.contactGroupService.createGroup(input as never);
	}

	/**
	 * Changes a group's descriptive facts, and its kind.
	 *
	 * The member count the service takes for its "a static group with hand-written members cannot
	 * become rule-based" refusal is passed as its own default: the count is the membership pivot's
	 * answer, and the pivot's module imports this one, so this resolver cannot reach it. The refusal
	 * remains in force for the segment materialiser, which owns the count.
	 */
	@Mutation('updateContactGroup')
	@Permissions(PermissionsEnum.CONTACT_GROUPS_EDIT)
	async updateContactGroup(@Args('input') input: IUpdateContactGroupInput): Promise<IContactGroup> {
		return this.contactGroupService.updateGroup(input.id, input as never);
	}

	/**
	 * Soft-deletes a group, which is the only removal path there is.
	 */
	@Mutation('deleteContactGroup')
	@Permissions(PermissionsEnum.CONTACT_GROUPS_DELETE)
	async deleteContactGroup(@Args('id', { type: () => ID }) id: Id): Promise<IContactGroup> {
		return this.contactGroupService.removeGroup(id);
	}
}

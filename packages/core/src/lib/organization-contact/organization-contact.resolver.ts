import { NotFoundException, ParseEnumPipe, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ContactType,
	ID as Id,
	IEditEntityByMemberInput,
	IEmployee,
	IOrganizationContact,
	IOrganizationContactCreateInput,
	IOrganizationContactFindInput,
	IOrganizationProject,
	IPagination,
	ITag,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import {
	OrganizationContactCreateCommand,
	OrganizationContactEditByEmployeeCommand,
	OrganizationContactUpdateCommand
} from './commands';
import { OrganizationContact } from './organization-contact.entity';
import { OrganizationContactService } from './organization-contact.service';

/** The members `ContactDetailInput` declares in the schema. */
export interface IContactDetailInput {
	id?: Id;
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

/** The members `CreateOrganizationContactInput` declares in the schema. */
export interface ICreateOrganizationContactInput {
	organizationId: Id;
	name: string;
	primaryEmail?: string;
	primaryPhone?: string;
	inviteStatus?: string;
	contactType?: ContactType;
	notes?: string;
	budget?: number;
	budgetType?: string;
	imageId?: Id;
	contact?: IContactDetailInput;
	memberIds?: Id[];
	projectIds?: Id[];
	tagIds?: Id[];
}

/** The members `UpdateOrganizationContactInput` declares in the schema. */
export interface IUpdateOrganizationContactInput extends ICreateOrganizationContactInput {
	id: Id;
}

/** The members `UpdateOrganizationContactsByEmployeeInput` declares in the schema. */
export interface IUpdateOrganizationContactsByEmployeeInput {
	organizationId: Id;
	memberId: Id;
	addedEntityIds?: Id[];
	removedEntityIds?: Id[];
}

/**
 * The fields a party list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OrganizationContactFilter` and
 * `OrganizationContactSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * The collections are in neither. `members`, `projects`, `tags` and the documents are rows the
 * delivered list read does not join, so a filter on one of them would be evaluated against a row
 * that carries none of them and would select nothing at all — the worst answer a filter can give.
 * Who works a party is the employee look-up's question, and it is a root field of its own because
 * the read behind it joins the pivot the list does not.
 */
const ORGANIZATION_CONTACT_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	primaryEmail: 'STRING',
	primaryPhone: 'STRING',
	inviteStatus: 'STRING',
	contactType: 'ENUM',
	imageUrl: 'STRING',
	userId: 'ID',
	channelId: 'ID',
	status: 'STRING',
	priceListId: 'ID',
	taxExempt: 'BOOLEAN',
	taxCategoryId: 'ID',
	budget: 'DECIMAL',
	budgetType: 'STRING',
	creditLimit: 'DECIMAL',
	creditUsed: 'DECIMAL',
	paymentTermsDays: 'NUMBER',
	loyaltyPoints: 'DECIMAL',
	defaultShippingAddressId: 'ID',
	defaultBillingAddressId: 'ID',
	acceptsMarketing: 'BOOLEAN',
	acquiredChannel: 'STRING',
	emailKey: 'STRING',
	externalId: 'STRING',
	partyKind: 'STRING',
	currency: 'STRING',
	paymentTermId: 'ID',
	taxRegistrationNumber: 'STRING',
	taxRegistrationScheme: 'STRING',
	taxRegimeId: 'ID',
	contactId: 'ID',
	imageId: 'ID',
	metadata: 'JSON',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const ORGANIZATION_CONTACT_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'primaryEmail',
	'contactType',
	'status',
	'creditLimit',
	'loyaltyPoints'
] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method applies no order of its own — it hands the store a filter and takes the
 * rows as they come back — so this is not a reproduction of the route's order but the order that
 * makes a cursor walk total: newest first, with the identifier as the last key so that two rows
 * written in the same millisecond still have one order between them.
 */
const ORGANIZATION_CONTACT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The party row over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `OrganizationContactService` method or dispatches the
 * same command the `/api/organization-contact` routes call.
 *
 * **The guard chain and the permission are the controller's, field by field.** The controller
 * carries `TenantPermissionGuard` on the class and states `PermissionGuard` with a permission on
 * seven of the routes this surface mirrors rather than on the class — the count, the creation, the
 * edit, the employee assignment, the removal, the soft removal and the recovery — so this resolver
 * carries the tenant guard on the class and states exactly that pair on exactly those seven fields.
 * Three of them mirror routes the CRUD base would otherwise have served ungated: the controller
 * overrides `delete`, `softRemove` and `softRecover` for no other reason than to attach the gate, and
 * a field left unpermissioned here would be a way to remove, withdraw or restore a party that the
 * route refuses — the same capability decided two different ways, with this surface as the permissive
 * one. The list, the one row and the employee look-up carry no permission on either surface, and
 * neither do the fields that mirror them: a field that demanded one would refuse a caller the REST
 * route serves.
 *
 * **A party is not written here.** The delivered create and edit dispatch a command whose handler
 * stores the party with its detail row in one call, so both fields dispatch that command rather than
 * reaching for the service: the detail row is a contact of the *contact* domain, and a resolver that
 * wrote one itself would be a second write path for the same fact.
 *
 * **The employee look-up is a field of its own rather than a filter on the connection.** The read
 * behind it joins the member pivot the list read does not, and it answers a projection of the row —
 * the identifier, the name and the avatar URL — so folding it into the connection would mean a
 * filter the evaluator could not evaluate over rows that carry no members.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('OrganizationContact')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class OrganizationContactResolver {
	constructor(
		private readonly organizationContactService: OrganizationContactService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The parties of the caller's organization, newest first.
	 */
	@Query('organizationContacts')
	async organizationContacts(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IOrganizationContact>> {
		// The same read the list route performs: the route hands the service the `relations` and the
		// `findInput` its `data` query parameter carries, and this surface has no query string to bind —
		// so the read runs with neither, and the connection protocol's `filter` is applied to the rows
		// the service returns. The tenant is applied to the criterion by the service, from the
		// credential rather than from the caller.
		const { items }: IPagination<IOrganizationContact> =
			await this.organizationContactService.findAllOrganizationContacts({});

		return buildConnection<IOrganizationContact>({
			rows: items ?? [],
			filterable: ORGANIZATION_CONTACT_FILTERABLE,
			sortable: ORGANIZATION_CONTACT_SORTABLE,
			defaultSort: ORGANIZATION_CONTACT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One party of the caller's organization.
	 *
	 * A party that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 *
	 * The delivered route joins the relations its `data` parameter names and none otherwise, so the
	 * field asks the same read for the same empty relation list — which is what a REST caller that
	 * names none gets.
	 */
	@Query('organizationContact')
	async organizationContact(@Args('id', { type: () => ID }) id: Id): Promise<IOrganizationContact | null> {
		try {
			return await this.organizationContactService.findById(id, []);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * The parties one employee works.
	 *
	 * The same read the route performs, with the same options: the employee is the path segment, the
	 * organization and the contact type are the query parameters the read is scoped and narrowed by,
	 * and the tenant is taken from the credential by the service rather than stated here.
	 */
	@Query('organizationContactsByEmployee')
	async organizationContactsByEmployee(
		@Args('employeeId', { type: () => ID }) employeeId: Id,
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('contactType', new ParseEnumPipe(ContactType, { optional: true })) contactType?: ContactType
	): Promise<IOrganizationContact[]> {
		return await this.organizationContactService.findByEmployee(employeeId, {
			organizationId,
			contactType
		} as IOrganizationContactFindInput);
	}

	/**
	 * How many parties the caller's organization holds.
	 *
	 * The same call the count route makes, with the same absence of narrowing: that route binds its
	 * query string to the store's own `where` and hands it to `countBy`, and the connection protocol
	 * has no argument of that shape, so the field passes none and counts the caller's own rows — the
	 * tenant is applied to the criterion by the service, from the credential.
	 */
	@Query('organizationContactCount')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CONTACT_VIEW)
	async organizationContactCount(): Promise<number> {
		return await this.organizationContactService.countBy();
	}

	/**
	 * Records a party, with the detail row the delivered handler stores beside it.
	 *
	 * The same command the create route dispatches, with the members the delivered body validates and
	 * the three relations its handler reads. The tenant is stamped by the service from the credential
	 * and is never stated by the caller.
	 */
	@Mutation('createOrganizationContact')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async createOrganizationContact(
		@Args('input') input: ICreateOrganizationContactInput
	): Promise<IOrganizationContact> {
		return await this.commandBus.execute(new OrganizationContactCreateCommand(this.payload(input)));
	}

	/**
	 * Changes a party that exists, and the detail row it carries.
	 *
	 * The same command the edit route dispatches, with the identifier in both places the delivered
	 * route carries it — the path and the body — because the handler reads the body's. It reads the
	 * row before it writes, so a party that is not there is a miss rather than a write under an
	 * identifier the caller does not own.
	 */
	@Mutation('updateOrganizationContact')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async updateOrganizationContact(
		@Args('input') input: IUpdateOrganizationContactInput
	): Promise<IOrganizationContact> {
		return await this.commandBus.execute(new OrganizationContactUpdateCommand(input.id, this.payload(input)));
	}

	/**
	 * Moves a set of parties into or out of one employee's book.
	 *
	 * The same command the route dispatches, with the employee named by its identifier: the command
	 * takes the row the identifier names, which is what the delivered body carries. A list the caller
	 * does not state is left out rather than sent empty, because the handler reads "nothing stated"
	 * and "nothing to change" as the same instruction.
	 */
	@Mutation('updateOrganizationContactsByEmployee')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	async updateOrganizationContactsByEmployee(
		@Args('input') input: IUpdateOrganizationContactsByEmployeeInput
	): Promise<boolean> {
		const payload: IEditEntityByMemberInput = {
			organizationId: input.organizationId,
			member: { id: input.memberId } as IEmployee,
			addedEntityIds: input.addedEntityIds,
			removedEntityIds: input.removedEntityIds
		} as IEditEntityByMemberInput;

		return await this.commandBus.execute(new OrganizationContactEditByEmployeeCommand(payload));
	}

	/**
	 * Removes a party outright.
	 *
	 * The delivered service refuses a row that is not there with the same `404` the REST route answers
	 * with, so a caller that names one is told it is missing rather than that the removal succeeded.
	 *
	 * The route overrides the inherited `CrudController.delete()` only to attach the gate, and states
	 * `@UseGuards(PermissionGuard)` with `ORG_CONTACT_EDIT` — the same permission its create and edit
	 * routes carry, because removing a party is the same administrative act as writing one. The field
	 * states the same pair: without it, any member of the tenant could remove a party here that the
	 * route refuses them.
	 */
	@Mutation('deleteOrganizationContact')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async deleteOrganizationContact(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.organizationContactService.delete(id);

		return true;
	}

	/**
	 * Withdraws a party: the row is marked rather than removed, and the recovery below reads it back.
	 *
	 * The route overrides the inherited `CrudController.softRemove()` only to attach the gate, and
	 * states `@UseGuards(PermissionGuard)` with `ORG_CONTACT_EDIT` — a withdrawal hides the party from
	 * every list, which is a removal as far as authority goes. The field states the same pair: the
	 * delivered route is not the ungated inherited one it used to be, so mirroring it means mirroring
	 * the gate.
	 */
	@Mutation('softDeleteOrganizationContact')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async softDeleteOrganizationContact(@Args('id', { type: () => ID }) id: Id): Promise<IOrganizationContact> {
		return await this.organizationContactService.softRemove(id);
	}

	/**
	 * Puts a withdrawn party back, clearing the marker the withdrawal set.
	 *
	 * The route overrides the inherited `CrudController.softRecover()` only to attach the gate, and
	 * states `@UseGuards(PermissionGuard)` with `ORG_CONTACT_EDIT`; the field states the same pair.
	 * Restoring is what undoes the withdrawal above, so a caller the withdrawal route refuses must not
	 * be able to reverse one here either.
	 */
	@Mutation('recoverOrganizationContact')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CONTACT_EDIT)
	async recoverOrganizationContact(@Args('id', { type: () => ID }) id: Id): Promise<IOrganizationContact> {
		return await this.organizationContactService.softRecover(id);
	}

	/**
	 * The payload the delivered create and edit handlers read.
	 *
	 * A related row is carried as the identifier the write persists — the member, the project and the
	 * tag are named by their identifiers and handed over as the rows the pivots are written from — and
	 * a list the caller did not state stays `undefined` rather than becoming `[]`: the handler reads
	 * "no members stated" as "derive them from the projects", and an empty list would be the
	 * instruction to clear the book instead.
	 */
	private payload(
		input: IUpdateOrganizationContactInput | ICreateOrganizationContactInput
	): IOrganizationContactCreateInput {
		return {
			organizationId: input.organizationId,
			name: input.name,
			primaryEmail: input.primaryEmail,
			primaryPhone: input.primaryPhone,
			inviteStatus: input.inviteStatus,
			contactType: input.contactType,
			notes: input.notes,
			budget: input.budget,
			budgetType: input.budgetType,
			imageId: input.imageId,
			// The detail row is stored with the party in the one call, which is why the handler receives
			// it as a member rather than being called again beside this one.
			contact: input.contact,
			members: input.memberIds?.map((id) => ({ id }) as IEmployee),
			projects: input.projectIds?.map((id) => ({ id }) as IOrganizationProject),
			tags: input.tagIds?.map((id) => ({ id }) as ITag)
		} as unknown as IOrganizationContactCreateInput;
	}
}

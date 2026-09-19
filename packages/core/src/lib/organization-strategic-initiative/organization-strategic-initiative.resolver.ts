import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	ID as Id,
	IOrganizationStrategicInitiative,
	IOrganizationStrategicInitiativeCreateInput,
	IOrganizationStrategicInitiativeFindInput,
	IOrganizationStrategicInitiativeUpdateInput,
	IOrganizationStrategicSignals,
	IPagination,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import {
	OrganizationStrategicInitiativeCreateCommand,
	OrganizationStrategicInitiativeUpdateCommand,
	OrganizationStrategicInitiativeUpdateSignalsCommand
} from './commands';
import {
	OrganizationStrategicInitiativeFindAllQuery,
	OrganizationStrategicInitiativeFindByProjectQuery,
	OrganizationStrategicInitiativeFindOneQuery
} from './queries';
import { OrganizationStrategicInitiative } from './organization-strategic-initiative.entity';
import { OrganizationStrategicInitiativeService } from './organization-strategic-initiative.service';

/** The members `CreateOrganizationStrategicInitiativeInput` declares in the schema. */
export interface ICreateOrganizationStrategicInitiativeInput {
	organizationId: Id;
	title: string;
	intent?: string;
	state?: string;
	visibilityScope?: string;
	signals?: Record<string, unknown>;
	stewardId?: Id;
}

/** The members `UpdateOrganizationStrategicInitiativeInput` declares in the schema. */
export interface IUpdateOrganizationStrategicInitiativeInput extends Partial<ICreateOrganizationStrategicInitiativeInput> {
	id: Id;
}

/** The members `UpdateOrganizationStrategicSignalsInput` declares in the schema. */
export interface IUpdateOrganizationStrategicSignalsInput {
	id: Id;
	confidenceLevel?: string;
	perceivedMomentum?: string;
	knownRisks?: string[];
	strategicNotes?: string;
	lastAssessedById?: Id;
}

/**
 * The fields a strategic-initiative list may be filtered and sorted by, and the order it is returned in
 * when the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OrganizationStrategicInitiativeFilter` and
 * `OrganizationStrategicInitiativeSortField` are its two renderings, and keeping the three in one file
 * is what makes a field that is filterable in the schema but unknown to the evaluator — or the reverse
 * — impossible to introduce quietly.
 *
 * The aligned projects and goals are in neither. The aligned projects are loaded by the delivered read
 * — the visibility rule for the `team` scope is computed from the teams of those projects — but the
 * connection's evaluator narrows a row by a member of that row, and an alignment is a pivot rather than
 * a member; the read that names a project is a root field of its own below.
 */
const ORGANIZATION_STRATEGIC_INITIATIVE_FILTERABLE = {
	id: 'ID',
	title: 'STRING',
	intent: 'STRING',
	state: 'STRING',
	visibilityScope: 'STRING',
	signals: 'JSON',
	stewardId: 'ID',
	organizationId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN'
} as const;

/** The fields the sort enum offers. */
const ORGANIZATION_STRATEGIC_INITIATIVE_SORTABLE = [
	'createdAt',
	'updatedAt',
	'title',
	'state',
	'visibilityScope'
] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list read applies no order of its own — it reads the rows the visibility rule admits
 * and leaves them in the store's order — so this is a decision the connection has to make rather than
 * one it reproduces: newest first, with the identifier as the last key so that two rows written in the
 * same millisecond still have one order between them and a cursor walk over them is stable.
 */
const ORGANIZATION_STRATEGIC_INITIATIVE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The organization strategic initiative over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below dispatches the same command or query, or calls the same service method,
 * that the `/api/organization-strategic-initiative` routes reach. The two writes and the signals
 * assessment dispatch commands because that is what the routes do — the create validates and records a
 * steward, the update reads the row before it writes, and the signals write merges into the document
 * the row already carries — and the three reads dispatch queries for the same reason.
 *
 * **The guard chain and the permissions are the controller's, field by field.** The controller carries
 * both guards on the class and states a permission on the seven routes it declares; the four it
 * inherits from the CRUD base carry none. So every field that mirrors a declared route states that
 * route's permission — the three reads the read permission, the create its own, the update and the
 * signals write the update permission, the removal the delete permission — and the four fields that
 * mirror inherited capabilities state none at all, because the routes they mirror carry none.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('OrganizationStrategicInitiative')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class OrganizationStrategicInitiativeResolver {
	constructor(
		private readonly organizationStrategicInitiativeService: OrganizationStrategicInitiativeService,
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus
	) {}

	/**
	 * The strategic initiatives the caller may see.
	 */
	@Query('organizationStrategicInitiatives')
	@Permissions(PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ)
	async organizationStrategicInitiatives(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<OrganizationStrategicInitiative>> {
		// The delivered list route binds the query DTO to the query string and hands it to the read. This
		// surface has no query string to bind, so the read runs with the route's own default for an
		// unstated request — the delivered service forces the relations its visibility rule needs onto
		// whatever it is handed, so naming none here does not hide the rows the rule is computed from —
		// and the connection protocol's `filter` is applied to the rows it returns.
		const options = {} as BaseQueryDTO<OrganizationStrategicInitiative> &
			IOrganizationStrategicInitiativeFindInput;
		const { items }: IPagination<IOrganizationStrategicInitiative> = await this.queryBus.execute(
			new OrganizationStrategicInitiativeFindAllQuery(options)
		);

		return buildConnection<OrganizationStrategicInitiative>({
			rows: items ?? [],
			filterable: ORGANIZATION_STRATEGIC_INITIATIVE_FILTERABLE,
			sortable: ORGANIZATION_STRATEGIC_INITIATIVE_SORTABLE,
			defaultSort: ORGANIZATION_STRATEGIC_INITIATIVE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One strategic initiative.
	 *
	 * An initiative that is not there — or one outside the caller's visibility scope, which the
	 * delivered read refuses with the same miss — answers `null` rather than a refusal: GraphQL has one
	 * answer for "no such row" on a field that may have none, and the REST route's `404` is that same
	 * fact stated in the other protocol's vocabulary.
	 */
	@Query('organizationStrategicInitiative')
	@Permissions(PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ)
	async organizationStrategicInitiative(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationStrategicInitiative | null> {
		try {
			const options = {} as BaseQueryDTO<OrganizationStrategicInitiative>;

			return await this.queryBus.execute(new OrganizationStrategicInitiativeFindOneQuery(id, options));
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * The strategic initiatives aligned to one project.
	 *
	 * The same read the delivered route performs, started at the same place: the project is named, the
	 * alignment is walked from it, and the rows are narrowed by the same visibility rule the list read
	 * applies. It answers a bare list rather than a connection because the route does — the read has no
	 * page to take — and because the alignment is not a member of the initiative the connection's
	 * evaluator could narrow by.
	 */
	@Query('organizationStrategicInitiativesByProject')
	@Permissions(PermissionsEnum.ORG_STRATEGIC_INITIATIVE_READ)
	async organizationStrategicInitiativesByProject(
		@Args('projectId', { type: () => ID }) projectId: Id
	): Promise<IOrganizationStrategicInitiative[]> {
		return await this.queryBus.execute(new OrganizationStrategicInitiativeFindByProjectQuery(projectId));
	}

	/**
	 * How many strategic initiatives the caller's tenant holds.
	 *
	 * No permission is stated because the route this mirrors declares none: the count is inherited from
	 * the CRUD base, where the controller's guard chain is the whole of its scope.
	 */
	@Query('organizationStrategicInitiativeCount')
	async organizationStrategicInitiativeCount(): Promise<number> {
		return await this.organizationStrategicInitiativeService.countBy();
	}

	/**
	 * Files a strategic initiative through the command the delivered route dispatches.
	 *
	 * The handler records the caller's own employee as the steward when the caller states none, which is
	 * why the field dispatches the command rather than writing the row itself.
	 */
	@Mutation('createOrganizationStrategicInitiative')
	@Permissions(PermissionsEnum.ORG_STRATEGIC_INITIATIVE_CREATE)
	async createOrganizationStrategicInitiative(
		@Args('input') input: ICreateOrganizationStrategicInitiativeInput
	): Promise<OrganizationStrategicInitiative> {
		return await this.commandBus.execute(
			new OrganizationStrategicInitiativeCreateCommand(
				input as unknown as IOrganizationStrategicInitiativeCreateInput
			)
		);
	}

	/**
	 * Changes a strategic initiative through the command the delivered route dispatches.
	 *
	 * The identifier is the criterion and is not repeated in the payload, which is the shape the route
	 * itself has: `:id` names the row and the body carries the facts. The handler reads the row before
	 * it writes, so an initiative of another tenant, or one that is not there, is answered with the
	 * miss rather than with a write under an identifier the caller does not own.
	 */
	@Mutation('updateOrganizationStrategicInitiative')
	@Permissions(PermissionsEnum.ORG_STRATEGIC_INITIATIVE_UPDATE)
	async updateOrganizationStrategicInitiative(
		@Args('input') input: IUpdateOrganizationStrategicInitiativeInput
	): Promise<OrganizationStrategicInitiative> {
		const { id, ...values } = input;

		return await this.commandBus.execute(
			new OrganizationStrategicInitiativeUpdateCommand(
				id,
				values as unknown as IOrganizationStrategicInitiativeUpdateInput
			)
		);
	}

	/**
	 * Records an assessment of a strategic initiative through the command the delivered route
	 * dispatches.
	 *
	 * The stated signals are laid over the ones the row already carries and the assessment is stamped
	 * with its time and the assessing employee, which is what makes this a merge rather than a
	 * replacement — and why the field dispatches the command instead of writing the document itself.
	 */
	@Mutation('updateOrganizationStrategicInitiativeSignals')
	@Permissions(PermissionsEnum.ORG_STRATEGIC_INITIATIVE_UPDATE)
	async updateOrganizationStrategicInitiativeSignals(
		@Args('input') input: IUpdateOrganizationStrategicSignalsInput
	): Promise<OrganizationStrategicInitiative> {
		const { id, ...signals } = input;

		return await this.commandBus.execute(
			new OrganizationStrategicInitiativeUpdateSignalsCommand(
				id,
				signals as unknown as IOrganizationStrategicSignals
			)
		);
	}

	/**
	 * Removes a strategic initiative outright.
	 *
	 * The delivered route calls the service directly rather than dispatching a command, so this field
	 * does the same.
	 */
	@Mutation('deleteOrganizationStrategicInitiative')
	@Permissions(PermissionsEnum.ORG_STRATEGIC_INITIATIVE_DELETE)
	async deleteOrganizationStrategicInitiative(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.organizationStrategicInitiativeService.delete(id);

		return true;
	}

	/**
	 * Withdraws a strategic initiative: the row is marked rather than removed, and the recovery below
	 * reads it back.
	 *
	 * No permission is stated because the route this mirrors declares none: the withdrawal is inherited
	 * from the CRUD base.
	 */
	@Mutation('softDeleteOrganizationStrategicInitiative')
	async softDeleteOrganizationStrategicInitiative(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationStrategicInitiative> {
		return await this.organizationStrategicInitiativeService.softRemove(id);
	}

	/**
	 * Puts a withdrawn strategic initiative back.
	 *
	 * Unpermissioned for the same reason the withdrawal above is: the delivered route is inherited.
	 */
	@Mutation('recoverOrganizationStrategicInitiative')
	async recoverOrganizationStrategicInitiative(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationStrategicInitiative> {
		return await this.organizationStrategicInitiativeService.softRecover(id);
	}
}

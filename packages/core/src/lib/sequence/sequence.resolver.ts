import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, ISequence, PermissionsEnum, SequenceResetPolicy } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { SequenceService } from './sequence.service';

/**
 * The members `CreateSequenceInput` declares in the schema.
 *
 * The counter is among them and the scope is not: a create is the one write that may state where a
 * series starts counting — an installation adopting numbering an external system already stepped has
 * to say where to continue from — while the tenant and the organization are stamped from the
 * credential, so a member here would promise a scope the write refuses.
 */
export interface ICreateSequenceInput {
	key: string;
	channelId?: Id;
	prefix?: string;
	padding?: number;
	nextValue?: number;
	step?: number;
	resetPolicy?: SequenceResetPolicy;
	description?: string;
}

/**
 * The members `UpdateSequenceInput` declares in the schema.
 *
 * The identity and the state are deliberately not among them. `key` and `channelId` are what every
 * allocation resolves the series by, and `nextValue` and `lastResetAt` are the value the next
 * document will be numbered with and the period the series last restarted in — a counter written
 * through a configuration write is how an installation issues one number twice. What is left is the
 * shape of the numbers the series produces, the note kept beside it, and the lifecycle member that
 * retires it without removing its counter.
 */
export interface IUpdateSequenceInput {
	id: Id;
	prefix?: string;
	padding?: number;
	step?: number;
	resetPolicy?: SequenceResetPolicy;
	description?: string;
	isActive?: boolean;
}

/**
 * The fields a series list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `SequenceFilter` and `SequenceSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the row, and the list is the resource's whole configuration rather than
 * a document trail: `nextValue` is a whole number compared as one, `resetPolicy` is a closed
 * vocabulary, and the two timestamps are instants compared as instants. `deletedAt` is absent because
 * the delivered reads answer live rows only and no route of this resource withdraws a series — a
 * series is retired through `isActive` — and the tenant and the organization are absent because both
 * are applied to the read from the credential rather than from the caller.
 */
const SEQUENCE_FILTERABLE = {
	id: 'ID',
	key: 'STRING',
	channelId: 'ID',
	prefix: 'STRING',
	padding: 'NUMBER',
	nextValue: 'NUMBER',
	step: 'NUMBER',
	resetPolicy: 'ENUM',
	lastResetAt: 'DATE',
	description: 'STRING',
	isActive: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const SEQUENCE_SORTABLE = ['key', 'nextValue', 'resetPolicy', 'createdAt', 'updatedAt'] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read orders by key, which is how a numbering configuration is read, and that is
 * the order reproduced here rather than replaced. The two members after it are the connection's own
 * addition and not a second order: one organization holds an organization-wide series and a series per
 * channel under one key, so `key` alone leaves rows equal to each other — and a cursor names a row
 * rather than a position among equals, which is why the channel and then the identifier make the order
 * total. `channelId` is null on the organization-wide row and the connection's own rule places an
 * absent value last under an ascending walk, so the row a channel falls back to stands after the
 * channel-scoped rows that override it.
 */
const SEQUENCE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'key', direction: 'ASC' },
	{ field: 'channelId', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The numbering series over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `SequenceService` method the `/api/sequences` route behind
 * it calls, with the same payload and the same request facts. Nothing here allocates a number or moves
 * a counter — a number is allocated by the domain that issues the document, inside the transaction
 * that writes it, which is the whole reason the series table exists.
 *
 * **The guard chain and the permission are the controller's.** The class carries what the controller
 * class carries — both protocol guards, and the read permission an administrator's reads run under —
 * and every field then states the permission its own route states, so a field is never narrower or
 * wider than the route it mirrors. The reads carry the view permission and the three writes the edit
 * permission, which is the pair `06-api-specification.md` §7.3 names for this resource.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is
 * appended to the chain above — after the controller's two, so a caller with no credential is refused
 * as a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, the catalogue's own entry for "the GraphQL endpoint and its resolvers, under the
 * same guards and permissions as REST". The code is imported rather than restated here because the
 * value has to agree with the catalogue's `code` and nothing checks one string against another: a
 * literal that drifted names a code no catalogue row carries, which the guard resolves as disabled —
 * so every field below would answer `Cannot query field <name>` for every caller, with nothing red
 * anywhere. One statement on the class puts every field behind it, and its effect is the REST one in
 * this protocol's vocabulary: a tenant that switched the capability off is answered
 * `Cannot query field <name>`, the same refusal a disabled capability's routes answer with a 404.
 *
 * This resolver is declared by `SequenceModule`, beside the service it calls, so the GraphQL host can
 * scan that module for it — a resolver injects services, and a module is what reaches them.
 */
@Resolver('Sequence')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.SEQUENCES_VIEW)
export class SequenceResolver {
	constructor(private readonly sequenceService: SequenceService) {}

	/**
	 * The numbering series of the caller's organization, by key.
	 */
	@Query('sequences')
	@Permissions(PermissionsEnum.SEQUENCES_VIEW)
	async sequences(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<ISequence>> {
		// The read takes the narrowing the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter` — `key` and
		// `channelId` among its members — and applies it to the rows the service returns, so the read
		// runs with the route's own defaults rather than narrowing twice down two code paths that could
		// come to disagree.
		const rows = await this.sequenceService.listSeries();

		return buildConnection<ISequence>({
			rows,
			filterable: SEQUENCE_FILTERABLE,
			sortable: SEQUENCE_SORTABLE,
			defaultSort: SEQUENCE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One series of the caller's organization.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary. A series of another organization is answered the same way, because
	 * the read is scoped by the service from the credential — a caller is never told that a series it
	 * may not read exists.
	 */
	@Query('sequence')
	@Permissions(PermissionsEnum.SEQUENCES_VIEW)
	async sequence(@Args('id', { type: () => ID }) id: Id): Promise<ISequence | null> {
		try {
			return await this.sequenceService.findSeriesOrFail(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * Opens a numbering series.
	 *
	 * The same service method the REST create route calls, with the same payload: the identity the
	 * allocation will resolve the series by, the shape of the numbers it produces, and — on this one
	 * write — the value it starts counting from.
	 */
	@Mutation('createSequence')
	@Permissions(PermissionsEnum.SEQUENCES_EDIT)
	async createSequence(@Args('input') input: ICreateSequenceInput): Promise<ISequence> {
		return await this.sequenceService.createSeries(input as never);
	}

	/**
	 * Changes the configuration of a series.
	 *
	 * The delivered route passes the identifier in the path and the body beside it to one service call,
	 * and this field does the same, so a member the caller omits is left as it is.
	 *
	 * The delivered route refuses a body that states the counter rather than stripping it, so a caller
	 * is told its edit was not applied instead of being answered for a write that changed nothing it
	 * asked for. This protocol states the same refusal in the schema's own vocabulary: the members the
	 * input does not declare cannot be stated at all. What the two surfaces share is the rule itself,
	 * which lives in the service both of them call.
	 */
	@Mutation('updateSequence')
	@Permissions(PermissionsEnum.SEQUENCES_EDIT)
	async updateSequence(@Args('input') input: IUpdateSequenceInput): Promise<ISequence> {
		const { id, ...values } = input;

		return await this.sequenceService.updateSeries(id, values as never);
	}

	/**
	 * Restarts a series, when its own policy says a restart is due.
	 *
	 * The same service method the REST reset route calls, with no payload: the operation performs a
	 * move on the series — it does not state the series' next value — and the kernel's restart has
	 * exactly one destination, which is the value a period starts at. The answer is the stored row, so
	 * a caller reads where the counter now stands rather than assuming the move happened.
	 *
	 * What the move refuses is the kernel's own answer and reaches the caller unchanged: a series whose
	 * policy is `NEVER`, one that has already restarted inside the current period, and one that has no
	 * period recorded yet are each declined with the reason that applies.
	 */
	@Mutation('resetSequence')
	@Permissions(PermissionsEnum.SEQUENCES_EDIT)
	async resetSequence(@Args('id', { type: () => ID }) id: Id): Promise<ISequence> {
		return await this.sequenceService.resetSeries(id);
	}
}

import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination } from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Skill } from './skill.entity';
import { SkillService } from './skill.service';

/** The members `CreateSkillInput` declares in the schema. */
export interface ICreateSkillInput {
	organizationId?: Id;
	name: string;
	description?: string;
	color: string;
	isActive?: boolean;
	isArchived?: boolean;
}

/** The members `UpdateSkillInput` declares in the schema. */
export interface IUpdateSkillInput extends Partial<ICreateSkillInput> {
	id: Id;
}

/**
 * The fields a skill list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `SkillFilter` and `SkillSortField` are its two
 * renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `name` is here because the delivered name route reads by it: folding that route into the
 * connection is only honest while the connection can express the same narrowing.
 */
const SKILL_FILTERABLE = {
	id: 'ID',
	organizationId: 'ID',
	name: 'STRING',
	description: 'STRING',
	color: 'STRING',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const SKILL_SORTABLE = ['createdAt', 'updatedAt', 'name'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method applies no order of its own, so this is a decision the connection has to
 * make rather than one it reproduces: alphabetically by name, because a skill list is a vocabulary
 * and a vocabulary is read in its own order, then the identifier, which is the key that makes the
 * order total and a cursor walk over it stable.
 */
const SKILL_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'name', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The skill over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `SkillService` the `/api/skills` routes call.
 *
 * **The guard is the controller's guard, and no permission is stated anywhere.** `SkillController`
 * carries `TenantPermissionGuard` and states no `@Permissions` on its class or on any route it
 * inherits, so this class carries that guard and the gate below and nothing else — no permission on
 * the class and none on a field. A permission here would refuse a caller the REST route serves, and
 * tightening the resource is a change to make in both places at once.
 *
 * **The delivered name route is folded into the connection's filter.** It reads one skill by its
 * name and joins nothing the list read does not, so a `name` filter answers the same row the route
 * does. One difference is stated rather than hidden: the delivered route builds its own query and
 * names no tenant in it, so it can answer a skill of another tenant, while this connection narrows
 * the tenant-scoped list read. The filter is therefore narrower than that one route, and reproducing
 * the wider read would mean handing this surface a cross-tenant one on purpose.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any
 * part of it.
 */
@Resolver('Skill')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class SkillResolver {
	constructor(private readonly skillService: SkillService) {}

	/**
	 * The skills of the caller's tenant, in the vocabulary's own order.
	 */
	@Query('skills')
	async skills(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Skill>> {
		// The delivered list route hands the service the query DTO it bound. This surface has no query
		// string to bind, so the read runs with the route's own defaults — no criterion, no relations, no
		// page — and the connection protocol's `filter` narrows the rows the service returns. The tenant
		// is applied to the criterion by the service, from the credential rather than from the caller.
		const options = {} as BaseQueryDTO<Skill>;
		const { items }: IPagination<Skill> = await this.skillService.findAll(options);

		return buildConnection<Skill>({
			rows: items ?? [],
			filterable: SKILL_FILTERABLE,
			sortable: SKILL_SORTABLE,
			defaultSort: SKILL_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One skill of the caller's tenant.
	 *
	 * A skill that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact stated
	 * in the other protocol's vocabulary.
	 */
	@Query('skill')
	async skill(@Args('id', { type: () => ID }) id: Id): Promise<Skill | null> {
		try {
			return await this.skillService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many skills the caller's tenant holds.
	 */
	@Query('skillCount')
	async skillCount(): Promise<number> {
		return await this.skillService.countBy();
	}

	/**
	 * Files a skill through the same service method the delivered create route calls.
	 */
	@Mutation('createSkill')
	async createSkill(@Args('input') input: ICreateSkillInput): Promise<Skill> {
		return await this.skillService.create(input as unknown as Skill);
	}

	/**
	 * Changes a skill through the same service method the delivered edit route calls.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered
	 * route answers the store's own update result — a statement about the write, `{ affected }` —
	 * which is not a row and not what a GraphQL field named `updateSkill` may return.
	 */
	@Mutation('updateSkill')
	async updateSkill(@Args('input') input: IUpdateSkillInput): Promise<Skill> {
		const { id, ...values } = input;

		await this.skillService.update(id, values as QueryDeepPartialEntity<Skill>);

		return await this.skillService.findOneByIdString(id);
	}

	/**
	 * Removes a skill outright.
	 */
	@Mutation('deleteSkill')
	async deleteSkill(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.skillService.delete(id);

		return true;
	}

	/**
	 * Withdraws a skill: the row is marked rather than removed, and the recovery below reads it back.
	 */
	@Mutation('softDeleteSkill')
	async softDeleteSkill(@Args('id', { type: () => ID }) id: Id): Promise<Skill> {
		return await this.skillService.softRemove(id);
	}

	/**
	 * Puts a withdrawn skill back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverSkill')
	async recoverSkill(@Args('id', { type: () => ID }) id: Id): Promise<Skill> {
		return await this.skillService.softRecover(id);
	}
}

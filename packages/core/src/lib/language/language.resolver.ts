import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { IPagination } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlagGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Language } from './language.entity';
import { LanguageService } from './language.service';

/**
 * The fields a language list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `LanguageFilter` and `LanguageSortField` are
 * its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `is_system` carries the column's own spelling rather than a camelCase rendering of it. The
 * evaluator reads the row's property by the name the filter states, and the property is `is_system`;
 * a camelCase member would read a property no row carries, so the filter would select nothing and
 * answer an empty page with no error anywhere.
 */
const LANGUAGE_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	code: 'STRING',
	is_system: 'BOOLEAN',
	description: 'STRING',
	color: 'STRING',
	isActive: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const LANGUAGE_SORTABLE = ['createdAt', 'updatedAt', 'name', 'code'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list route declares no order of its own — it hands the service the query string it
 * was given and the store answers in the order it happens to hold the rows in — so this is a decision
 * the connection has to make rather than one it reproduces: by name, because a list of languages is
 * a vocabulary and a vocabulary is read in its own order, then the identifier, which is the key that
 * makes the order total and a cursor walk over it stable.
 */
const LANGUAGE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'name', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The platform's language master over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: the one field below calls the same `LanguageService.findAll` the `GET /api/languages`
 * route calls, and answers with the same rows that route answers.
 *
 * **The guard chain is the controller's, and the controller's is none.** `LanguageController`
 * declares no `@UseGuards` and no `@Permissions` anywhere, so this resolver states no guard of its
 * own beyond the gate and no permission: a guard or a permission here would refuse a caller the
 * routes serve.
 *
 * **The `@Public()` both delivered routes state is deliberately not restated, and that is the one
 * place this surface is narrower than the routes it mirrors.** The marker is read by the global
 * `AuthGuard` the bootstrap installs, which returns before passport runs — so a `@Public()` field
 * would execute with no authenticated user on the request, and the request context that both the
 * tenant guard and the capability gate resolve from would answer no tenant at all. The gate would
 * then fall back to the deployment's configured state for `FEATURE_GRAPHQL`, which this installation
 * does not name, and refuse the field to *every* caller — including the tenant that switched the
 * capability on. That is not a hypothetical: it is the failure the platform observed on the two
 * reference-data resolvers that were gated, which is why those two are named on the gate's
 * allow-list. A field nobody can read is worse than a field that is narrower than its route, so this
 * field carries the gate and no marker: it is served to a caller who presents a credential whose
 * tenant has the capability enabled, and refused to an anonymous caller the REST routes would admit.
 * The delivery states that rather than shipping a field that answers `Cannot query field languages`
 * to everybody.
 *
 * **There is one field and no more.** The controller serves two reads and no route of it writes: the
 * list, and a read by name that joins nothing the list read does not — so the second folds into the
 * connection's `name` filter. There is no node field and no count field either, because there is no
 * node route and no count route to mirror, and no mutation, because a capability with no REST route
 * behind it is the one thing this surface must not invent.
 */
@Resolver('Language')
@UseGuards(FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class LanguageResolver {
	constructor(private readonly languageService: LanguageService) {}

	/**
	 * The languages the platform knows, in the vocabulary's own order.
	 *
	 * The reader is the one the list route calls, with the route's own absence of narrowing: the route
	 * binds whatever query string it is given and hands it on, and this surface has no query string to
	 * bind, so the field runs the same call with nothing stated and applies the connection protocol to
	 * the rows it answers. That is not a compromise — the rows are exactly the set the service decided
	 * the caller may see, and the operators the protocol evaluates are the platform's own.
	 */
	@Query('languages')
	async languages(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Language>> {
		const { items }: IPagination<Language> = await this.languageService.findAll();

		return buildConnection<Language>({
			rows: items ?? [],
			filterable: LANGUAGE_FILTERABLE,
			sortable: LANGUAGE_SORTABLE,
			defaultSort: LANGUAGE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}
}

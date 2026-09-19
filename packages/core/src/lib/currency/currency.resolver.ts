import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag, Public } from '@gauzy/common';
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
import { Currency } from './currency.entity';
import { CurrencyService } from './currency.service';

/**
 * The fields a currency list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `CurrencyFilter` and `CurrencySortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `roundingIncrement` is `DECIMAL` rather than `NUMBER`: it is a quantity in the money family, and the
 * column behind it is `numeric(20,6)`, so a bound is compared as an exact decimal rather than through
 * a binary fraction. `symbolPosition` and `roundingMode` are `STRING` because their vocabularies are
 * the money layer's own and this surface carries their values — see the object type.
 */
const CURRENCY_FILTERABLE = {
	id: 'ID',
	isoCode: 'STRING',
	currency: 'STRING',
	decimalPlaces: 'NUMBER',
	symbol: 'STRING',
	symbolPosition: 'STRING',
	symbolSpace: 'BOOLEAN',
	roundingMode: 'STRING',
	roundingIncrement: 'DECIMAL',
	isTender: 'BOOLEAN',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const CURRENCY_SORTABLE = ['createdAt', 'updatedAt', 'isoCode', 'currency'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list route declares no order of its own — `findAll` is the store's own find, and the
 * store answers in the order it happens to hold the rows in, which differs between installations and
 * is not stable enough for a cursor to walk. The connection therefore makes the decision rather than
 * reproducing one: by code ascending, because the code is the row's identity and the order an operator
 * reconciles a report against, then by the identifier, which is the key that makes the order total
 * even for the rows a historical master may hold two of.
 */
const CURRENCY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'isoCode', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The platform's currency master over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: the one field below calls the same `CurrencyService.findAll` the `GET /api/currency` route
 * calls, and answers with the same rows that route answers.
 *
 * **The guard chain is the controller's, and the controller's is none.** `CurrencyController` carries
 * the platform's `Public()` marker and declares no guard and no permission, so this resolver declares
 * no `@UseGuards` and no `@Permissions`: a guard here would refuse a caller the route serves and a
 * permission would demand a grant no route asks for. The marker is stated rather than left off,
 * because the openness is this resource's decision — a currency master is reference data every client
 * reads, including one that holds no credential yet — and a decision should be readable as one rather
 * than inferred from a decorator that is not there.
 *
 * **There is one field and no more.** The controller serves one route and no route of it writes, so
 * there is no node field, no count field and no mutation between them: each of the three would be a
 * capability with no REST route behind it, and an installation that reads one currency reads it
 * through the connection narrowed by `isoCode`.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('Currency')
@Public()
@UseGuards(FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class CurrencyResolver {
	constructor(private readonly currencyService: CurrencyService) {}

	/**
	 * The platform's currency master, by ISO 4217 code.
	 *
	 * The reader is the one the list route calls, with the route's own absence of narrowing: the route
	 * takes no query DTO and hands the service no options, so this field runs the same bare call and
	 * applies the connection protocol to the rows it answers. That is not a compromise — the rows are
	 * exactly the set the service decided the caller may see, and the operators the protocol evaluates
	 * are the platform's own.
	 */
	@Query('currencies')
	async currencies(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Currency>> {
		const { items }: IPagination<Currency> = await this.currencyService.findAll();

		return buildConnection<Currency>({
			rows: items ?? [],
			filterable: CURRENCY_FILTERABLE,
			sortable: CURRENCY_SORTABLE,
			defaultSort: CURRENCY_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}
}

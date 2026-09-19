import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { Public } from '@gauzy/common';
import { IPagination } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { Country } from './country.entity';
import { CountryService } from './country.service';

/**
 * The fields a country list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `CountryFilter` and `CountrySortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `isActive` and `isArchived` are among the filterable fields because they are columns of this row and
 * a caller that administers the master opens it to ask what is still in use; nothing in this surface
 * writes either of them.
 */
const COUNTRY_FILTERABLE = {
	id: 'ID',
	isoCode: 'STRING',
	country: 'STRING',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const COUNTRY_SORTABLE = ['createdAt', 'updatedAt', 'isoCode', 'country'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list route declares no order of its own — `findAll` is the store's own find, and the
 * store answers in the order it happens to hold the rows in, which differs between installations and
 * is not stable enough for a cursor to walk. The connection therefore makes the decision rather than
 * reproducing one: by code ascending, because the code is the row's identity and the order a country
 * picker is reconciled against, then by the identifier, which is the key that makes the order total.
 */
const COUNTRY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'isoCode', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The platform's country master over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: the one field below calls the same `CountryService.findAll` the `GET /api/country` route
 * calls, and answers with the same rows that route answers.
 *
 * **The guard chain is the controller's, and the controller's is none.** `CountryController` carries
 * the platform's `Public()` marker and declares no guard and no permission, so this resolver declares
 * no `@UseGuards` and no `@Permissions`: a guard here would refuse a caller the route serves and a
 * permission would demand a grant no route asks for. The marker is stated rather than left off,
 * because the openness is this resource's decision — a country master is reference data every client
 * reads, including one that holds no credential yet — and a decision should be readable as one rather
 * than inferred from a decorator that is not there.
 *
 * **There is one field and no more.** The controller serves one route and no route of it writes, so
 * there is no node field, no count field and no mutation between them: each of the three would be a
 * capability with no REST route behind it, and an installation that reads one country reads it through
 * the connection narrowed by `isoCode`.
 *
 * **This resolver carries no feature gate, and that is deliberate.** The gate the rest of the GraphQL
 * surface carries is tenant-scoped: `FeatureFlagGuard` asks the feature service whether the code is
 * enabled *for the caller's tenant*, and it resolves that from the request context. A `@Public()` handler
 * runs without the tenant guard that establishes that context, so a gate here answered "disabled" for a
 * caller whose tenant has the capability switched on — this surface was refused to everybody the moment
 * it was gated, which is how the two reference-data resolvers came to be the exception. And the question
 * is not meaningful for this resource anyway: a country is installation-wide reference data and its table
 * carries no tenancy column, so there is no tenant whose rows could give a different answer.
 * `tools/scripts/graphql-feature-gate-check.mjs` records the exemption with this reason.
 */
@Resolver('Country')
@Public()
export class CountryResolver {
	constructor(private readonly countryService: CountryService) {}

	/**
	 * The platform's country master, by ISO 3166-1 code.
	 *
	 * The reader is the one the list route calls, with the route's own absence of narrowing: the route
	 * takes no query DTO and hands the service no options, so this field runs the same bare call and
	 * applies the connection protocol to the rows it answers. That is not a compromise — the rows are
	 * exactly the set the service decided the caller may see, and the operators the protocol evaluates
	 * are the platform's own.
	 */
	@Query('countries')
	async countries(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Country>> {
		const { items }: IPagination<Country> = await this.countryService.findAll();

		return buildConnection<Country>({
			rows: items ?? [],
			filterable: COUNTRY_FILTERABLE,
			sortable: COUNTRY_SORTABLE,
			defaultSort: COUNTRY_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}
}

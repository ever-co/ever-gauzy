import { FindManyOptions, FindOptionsWhere, ILike, IsNull, LessThanOrEqual, Like, MoreThan } from 'typeorm';
import { LIKE_OPERATOR } from '@gauzy/core';

/**
 * The predicates the tax listings narrow with, written so that both ORMs answer the same question.
 *
 * These listings used to be predicated with TypeORM's `Raw()`, which is a SQL fragment the other ORM
 * never sees. `CrudService.paginate`'s MikroORM arm runs a `where` through `processFindOperator`, and
 * `raw` has no MikroORM equivalent: until this branch it was answered with `{}` — *no* condition on
 * that property — so under `DB_ORM=mikro-orm` the validity window evaporated and the listing returned
 * every rate and regime of the organization, including ones that had been superseded and ones that
 * had not started yet. A caller that takes the first row to price a line charged a rate that is not in
 * force, and nothing anywhere reported it. The kernel now raises on `raw` instead, which turns the
 * wrong answer into a failed request — better, but still not an answer.
 *
 * So the predicates are expressed with the operators both ORMs translate — `IsNull`, `LessThanOrEqual`,
 * `MoreThan`, `Like`/`ILike` — and the disjunctions with the array form of `where`, which is OR on
 * TypeORM and is turned into `$or` by MikroORM's own `QueryHelper.processWhere`. `TenantAwareCrudService`
 * spreads the tenant and organization scope into *each* element of such an array, so the array form does
 * not widen the read past the caller's tenant.
 */

/** The page size a listing answers with when the caller states none. */
export const DEFAULT_PAGE_SIZE = 25;

/** The largest page a caller may ask for; a larger request is clamped rather than refused. */
export const MAX_PAGE_SIZE = 200;

/** What a caller asked for, in the two spellings the root fields accept. */
export interface IPageRequest {
	/** The offset spelling's page size. */
	limit?: number;
	/** The cursor spelling's page size. */
	first?: number;
	/** The offset spelling's starting row. */
	offset?: number;
}

/**
 * Narrows a listing to the rows whose validity window contains a moment.
 *
 * The window is `(startsAt IS NULL OR startsAt <= liveAt) AND (endsAt IS NULL OR endsAt > liveAt)`:
 * an open bound is unbounded, so a rate that never stated a start and one that was never ended are
 * both still in force. Neither ORM can express "null or a comparison" on one property in one
 * condition object, so the conjunction of two disjunctions is expanded into its four combinations and
 * handed over as an array — which is exactly the same set of rows, and is a shape both ORMs read.
 *
 * `endsAt` is compared with `>` and `startsAt` with `<=` on purpose: the window is half-open, so the
 * instant a rate ends is the first instant it is no longer charged, and a successor rate starting at
 * that same instant is in force for it. Two rates that abut therefore never both apply, and never
 * leave a gap.
 *
 * @param where The conditions built so far, which every combination carries.
 * @param liveAt The moment the window is evaluated at.
 * @returns One condition per combination of the two open bounds, to be read as a disjunction.
 */
export function liveWindowConditions<T extends object>(
	where: FindOptionsWhere<T>,
	liveAt: Date
): Array<FindOptionsWhere<T>> {
	const started = [IsNull(), LessThanOrEqual(liveAt)];
	const notEnded = [IsNull(), MoreThan(liveAt)];
	const conditions: Array<FindOptionsWhere<T>> = [];

	for (const startsAt of started) {
		for (const endsAt of notEnded) {
			// Through `unknown`: the literal names two members `T` need not declare, and TypeScript
			// refuses a direct assertion between two object types that do not overlap enough. The
			// entities this is called for all carry the two columns — that is what makes the helper
			// shared — and the generic is what keeps the *rest* of the condition typed.
			conditions.push({ ...(where as object), startsAt, endsAt } as unknown as FindOptionsWhere<T>);
		}
	}

	return conditions;
}

/**
 * Narrows a listing by a free-text term matched against several columns.
 *
 * The term is matched with `ILIKE` on Postgres and `LIKE` everywhere else, which is the decision
 * `LIKE_OPERATOR` already makes for the whole platform — MySQL and SQLite match case-insensitively
 * under their default collations, and Postgres does not, so the operator has to differ for the answer
 * to be the same. The constant is read rather than restated so there is one place that knows.
 *
 * @param where The conditions built so far, which every column's condition carries.
 * @param fields The columns the term is matched against.
 * @param search The term, already trimmed.
 * @returns One condition per column, to be read as a disjunction.
 */
export function searchConditions<T extends object>(
	where: FindOptionsWhere<T>,
	fields: string[],
	search: string
): Array<FindOptionsWhere<T>> {
	const pattern = `%${search}%`;
	const matches = LIKE_OPERATOR === 'ILIKE' ? ILike(pattern) : Like(pattern);

	return fields.map((field) => ({ ...(where as object), [field]: matches }) as FindOptionsWhere<T>);
}

/**
 * States the page a listing answers with, in the spelling `CrudService.paginate` reads.
 *
 * Two defects are closed here. **`take` was left undefined**, and the two ORMs disagree about what
 * that means: `paginate`'s TypeORM arm defaults it to ten rows, while its MikroORM arm sets no limit
 * at all — so the same unpaged query answered ten rows on one deployment and the organization's whole
 * table on the other, from a public GraphQL field. **And `skip` was assigned the row offset**, but
 * `skip` is a one-based *page number* on this platform and both arms multiply it: `offset: 20` with no
 * limit asked for row 190 on TypeORM and computed `undefined * 19` — `NaN` — on MikroORM.
 *
 * The offset spelling is therefore translated into the page that contains the requested row. Clients
 * page by adding the limit to the offset, so the translation is exact for every walk of a listing; an
 * offset that falls inside a page resolves to the start of that page rather than being multiplied into
 * a row far past the end of the table.
 *
 * @param options The find options being built.
 * @param request What the caller asked for.
 * @returns The same options, with the page stated.
 */
export function applyPageWindow<T>(options: FindManyOptions<T>, request: IPageRequest): FindManyOptions<T> {
	const requested = Number(request.limit ?? request.first ?? DEFAULT_PAGE_SIZE);
	const size = Number.isFinite(requested) ? Math.trunc(requested) : DEFAULT_PAGE_SIZE;
	const take = Math.min(Math.max(size || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

	const stated = Number(request.offset ?? 0);
	const offset = Number.isFinite(stated) ? Math.max(Math.trunc(stated), 0) : 0;

	options.take = take;
	options.skip = Math.floor(offset / take) + 1;

	return options;
}

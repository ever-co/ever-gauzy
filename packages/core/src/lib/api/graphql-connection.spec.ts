import { BadRequestException } from '@nestjs/common';
import { CursorCodec } from './cursor';
import { ConnectionFilter, ConnectionFieldKind, buildConnection, connectionFromPage } from './graphql-connection';

/**
 * The connection contract, at the kernel rather than through a domain.
 *
 * Every list root field of the platform answers through `buildConnection`, so a defect here is a
 * defect in every one of them at once, and this suite pins the three behaviours a domain resolver
 * spec cannot see from its own side:
 *
 * - **a date column is compared as an instant.** A store returns a `timestamp` column as a `Date`
 *   and a caller states an instant as RFC 3339 text, so the two sides of one comparison arrive in two
 *   different shapes. Comparing them as they arrived compared epoch milliseconds against a calendar
 *   date, and `createdAt: { eq: "..." }` — as well as every range over a date — matched no row at all.
 *   A filter that silently selects nothing is the worst kind of wrong answer, so it is asserted here
 *   rather than trusted;
 * - a value that is absent sorts last in both directions, and `isNull` is a condition of its own;
 * - a field the resource does not declare, or an operator its kind does not offer, is refused with
 *   the query protocol's own code rather than ignored.
 *
 * The rows are plain objects: what a domain hands the connection is what its own list method
 * answered, which is a row shape rather than an entity this suite would have to build.
 */

const EARLY = '00000000-0000-4000-8000-000000000001';
const LATE = '00000000-0000-4000-8000-000000000002';
const UNDATED = '00000000-0000-4000-8000-000000000003';

/** The fields the resource declares filterable, and the kind each is compared as. */
const FILTERABLE: Readonly<Record<string, ConnectionFieldKind>> = {
	id: 'ID',
	name: 'STRING',
	quantity: 'NUMBER',
	placedAt: 'DATE',
	enabled: 'BOOLEAN'
};

/** Three rows: one before the instant under test, one exactly at it, and one that states no date. */
const ROWS = [
	{ id: EARLY, name: 'earlier', quantity: 1, enabled: true, placedAt: new Date('2026-02-01T09:00:00.000Z') },
	{ id: LATE, name: 'later', quantity: 3, enabled: false, placedAt: new Date('2026-03-01T10:00:00.000Z') },
	{ id: UNDATED, name: 'undated', quantity: 2, enabled: true, placedAt: null }
];

/** The declaration every case below narrows, in the delivered order of the rows. */
const DECLARATION = {
	rows: ROWS,
	filterable: FILTERABLE,
	sortable: ['name', 'quantity', 'placedAt'] as const,
	defaultSort: [{ field: 'name', direction: 'ASC' }] as const
};

/** One connection over the fixture rows, with whatever the caller stated. */
function connect(request: Parameters<typeof buildConnection>[0]['request']) {
	return buildConnection({ ...DECLARATION, request });
}

/** Whether an error is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return (
		error instanceof BadRequestException &&
		(error.getStatus() === 400 || error.getStatus() === 422)
	);
}

describe('buildConnection — a date column is compared as an instant', () => {
	it('matches one row by the instant it was placed at, stated as the wire states it', () => {
		const connection = connect({ filter: { placedAt: { eq: '2026-03-01T10:00:00.000Z' } } });

		expect(connection.nodes.map((row) => row.id)).toEqual([LATE]);
		expect(connection.totalCount).toBe(1);
	});

	it('matches the same row when the caller states the instant in another of its spellings', () => {
		// The zone is an offset spelling of the same instant, and a comparison on instants is blind to
		// how the instant was written down.
		const connection = connect({ filter: { placedAt: { eq: '2026-03-01T11:00:00.000+01:00' } } });

		expect(connection.nodes.map((row) => row.id)).toEqual([LATE]);
	});

	it('orders a range over a date column by the calendar rather than by the text', () => {
		const after = connect({ filter: { placedAt: { gt: '2026-02-15T00:00:00.000Z' } } });
		expect(after.nodes.map((row) => row.id)).toEqual([LATE]);

		const before = connect({ filter: { placedAt: { lt: '2026-02-15T00:00:00.000Z' } } });
		expect(before.nodes.map((row) => row.id)).toEqual([EARLY]);

		const between = connect({
			filter: { placedAt: { between: ['2026-01-01T00:00:00.000Z', '2026-02-15T00:00:00.000Z'] } }
		});
		expect(between.nodes.map((row) => row.id)).toEqual([EARLY]);
	});

	it('excludes the rows that state no date from a range, and selects them with isNull', () => {
		// A row with no instant is not "before" the bound: it has nothing to compare, so it is out of
		// every range and reachable only by the condition that asks for its absence.
		const range = connect({ filter: { placedAt: { gt: '2026-01-01T00:00:00.000Z' } } });
		expect(range.nodes.map((row) => row.id)).toEqual([EARLY, LATE]);

		const absent = connect({ filter: { placedAt: { isNull: true } } });
		expect(absent.nodes.map((row) => row.id)).toEqual([UNDATED]);
	});

	it('matches a stated instant the calendar cannot read against nothing rather than against the epoch', () => {
		// The value is refused by the parser before it reaches here on the REST side; a value that
		// reaches the connection in a shape no calendar reads is compared as it stands, so it selects
		// no dated row instead of quietly selecting every row.
		const connection = connect({ filter: { placedAt: { eq: 'the day before' } } });

		expect(connection.nodes).toEqual([]);
	});

	it('compares a text column by its text, so a date-shaped identifier is not read as an instant', () => {
		const rows = [{ id: EARLY, name: '2026-03-01T10:00:00.000Z' }, { id: LATE, name: '2026-03-01T10:00:00.001Z' }];

		const connection = buildConnection({
			rows,
			filterable: { id: 'ID', name: 'STRING' },
			sortable: ['name'],
			defaultSort: [{ field: 'name', direction: 'ASC' }],
			request: { filter: { name: { eq: '2026-03-01T10:00:00.000Z' } } }
		});

		expect(connection.nodes.map((row) => row.id)).toEqual([EARLY]);
	});
});

describe('connectionFromPage — the page a service already sliced', () => {
	it('answers the rows, the count of the filtered set and the boundary cursors', () => {
		const connection = connectionFromPage({ items: ROWS.slice(0, 2), total: ROWS.length }, { skip: 0 });

		// The count is the filtered total the service reported, not the size of the page: a client that
		// is told "2" for a set of three cannot know whether to ask for more.
		expect(connection.nodes).toHaveLength(2);
		expect(connection.totalCount).toBe(ROWS.length);
		expect(connection.pageInfo.hasNextPage).toBe(true);
		expect(connection.pageInfo.hasPreviousPage).toBe(false);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[1].cursor);
	});

	it('decides the boundary from the offset the caller stated, not from the rows', () => {
		const connection = connectionFromPage({ items: ROWS.slice(2), total: ROWS.length }, { skip: 2 });

		// A second page has a previous page whatever its rows look like, and the offset is the only fact
		// that says so — which is why it is passed in rather than inferred.
		expect(connection.pageInfo.hasPreviousPage).toBe(true);
		expect(connection.pageInfo.hasNextPage).toBe(false);
	});

	it('derives a row’s cursor from the caller’s own key when it states one', () => {
		const connection = connectionFromPage(
			{ items: [{ id: EARLY, code: 'PO-1' }], total: 1 },
			{ cursorOf: (row) => row.code }
		);

		expect(connection.edges[0].cursor).toBe('PO-1');
		expect(connection.pageInfo.endCursor).toBe('PO-1');
	});

	it('answers an empty page rather than nulls when there is nothing to answer', () => {
		const connection = connectionFromPage(undefined);

		expect(connection.nodes).toEqual([]);
		expect(connection.edges).toEqual([]);
		expect(connection.totalCount).toBe(0);
		expect(connection.pageInfo.startCursor).toBeNull();
		expect(connection.pageInfo.endCursor).toBeNull();
	});

	it('takes the page size as the count when the service states no total', () => {
		const connection = connectionFromPage({ items: ROWS.slice(0, 2) });

		expect(connection.totalCount).toBe(2);
		expect(connection.pageInfo.hasNextPage).toBe(false);
	});
});

describe('buildConnection — the shape of a page', () => {
	it('answers with nodes, edges, the total and the boundary cursors', () => {
		const connection = connect(undefined);

		expect(connection.nodes).toHaveLength(3);
		expect(connection.totalCount).toBe(3);
		expect(connection.edges).toHaveLength(3);
		expect(connection.pageInfo.startCursor).toBe(connection.edges[0].cursor);
		expect(connection.pageInfo.endCursor).toBe(connection.edges[2].cursor);
		expect(connection.pageInfo.hasNextPage).toBe(false);
		expect(connection.pageInfo.hasPreviousPage).toBe(false);
	});

	it('walks from an opaque cursor the platform’s own codec can read', () => {
		const first = connect({ first: 1 });
		expect(first.nodes.map((row) => row.id)).toEqual([EARLY]);
		expect(first.pageInfo.hasNextPage).toBe(true);

		const second = connect({ first: 1, after: first.pageInfo.endCursor ?? undefined });
		expect(second.nodes.map((row) => row.id)).toEqual([LATE]);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
		expect(CursorCodec.decode(second.edges[0].cursor).id).toBe(LATE);
	});

	it('sorts by a declared key, and treats an absent value as the largest one in both directions', () => {
		// One rule rather than two, and the same rule on every installation: a null sorts after every
		// present value ascending and before every present value descending. A cursor walk is only
		// stable if the order it walks is, which is why this is stated rather than left to a store.
		const ascending = connect({ sort: [{ field: 'placedAt', direction: 'ASC' }] });
		expect(ascending.nodes.map((row) => row.id)).toEqual([EARLY, LATE, UNDATED]);

		const descending = connect({ sort: [{ field: 'placedAt', direction: 'DESC' }] });
		expect(descending.nodes.map((row) => row.id)).toEqual([UNDATED, LATE, EARLY]);
	});
});

describe('buildConnection — what a caller may state', () => {
	it('refuses a field the resource does not declare', () => {
		const error = (() => {
			try {
				connect({ filter: { productId: { eq: EARLY } } as ConnectionFilter });

				return undefined;
			} catch (thrown) {
				return thrown;
			}
		})();

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_UNKNOWN_FILTER_FIELD');
	});

	it('refuses a sort key the resource does not declare', () => {
		const error = (() => {
			try {
				connect({ sort: [{ field: 'placedAt', direction: 'ASC' }, { field: 'id', direction: 'ASC' }] });

				return undefined;
			} catch (thrown) {
				return thrown;
			}
		})();

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('QUERY_SORT_NOT_ALLOWED');
	});

	it('refuses both pagination styles at once rather than silently preferring one', () => {
		const error = (() => {
			try {
				connect({ first: 1, offset: 1 });

				return undefined;
			} catch (thrown) {
				return thrown;
			}
		})();

		expect(isRefusal(error)).toBe(true);
	});
});

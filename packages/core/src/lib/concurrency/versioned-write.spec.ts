import { NotFoundException } from '@nestjs/common';
import type { ID } from '@gauzy/contracts';
import type { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import type { BaseEntity } from '../core/entities/base.entity';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import type { IVersionExpectation } from './version.util';
import { VERSION_EXPECTATION_PROPERTY } from './version.util';
import { commitVersionedUpdate, versionExpectationOf } from './versioned-write';

/**
 * The write that carries the version check in its own `WHERE`.
 *
 * The guard refuses a stale write before the handler runs, but the guard's read and the handler's
 * write are two statements: between them another request can land. This helper is the half that
 * closes that window — one `UPDATE … WHERE id = :id AND version = :expected SET version = :next` —
 * and the affected-row count is the whole answer: one row means the write landed, zero means the
 * record moved on or is gone, and neither is absorbed.
 *
 * So the cases below are about the statement rather than about the outcome: what the criteria
 * actually carry, what travels in the patch beside the caller's own columns, and which of the three
 * answers an affected-row count produces. The service is a double that keeps every statement it was
 * handed, because "the check and the write are one statement" is only true if the version is in the
 * `WHERE` — an update predicated on anything else is the read-then-write race this exists to close.
 */

/**
 * A stand-in for the `CrudService` the helper writes through.
 *
 * The helper makes exactly two kinds of call — a version-predicated `update` and a read of the row,
 * which only happens when the update matched nothing or when the expectation named no single
 * version — so the double keeps both statements and answers with whatever the case needs.
 */
class VersionedTable {
	readonly criteria: Record<string, unknown>[] = [];
	readonly patches: Record<string, unknown>[] = [];
	readonly reads: ID[] = [];
	/** What the conditional update answers with: a count, or the row itself on the ORM that reports one. */
	answer: unknown = { affected: 1 };
	/** The row a read finds. `null` means the record is gone. */
	row: Record<string, unknown> | null = { id: 'invoice-1', version: 4 };
	/** Raised by the read instead of answering, when a case wants the read itself to fail. */
	failure: Error | null = null;

	async update(criteria: Record<string, unknown>, patch: Record<string, unknown>): Promise<unknown> {
		this.criteria.push(criteria);
		this.patches.push(patch);

		return this.answer;
	}

	async findOneByIdString(id: ID): Promise<unknown> {
		this.reads.push(id);

		if (this.failure) {
			throw this.failure;
		}

		return this.row;
	}
}

/** The helper's service, and the statements it received. */
function serviceWith(overrides: Partial<VersionedTable> = {}) {
	const table = new VersionedTable();

	Object.assign(table, overrides);

	return { service: table as unknown as CrudService<BaseEntity>, table };
}

/** The request a guard has already run on: what it accepted, under the property the write reads. */
const accepted = (expectation: IVersionExpectation) => ({ [VERSION_EXPECTATION_PROPERTY]: expectation });

/** The refusal a call raises, so a case asserts on a refusal instead of on a resolved promise. */
async function refusalFrom(work: () => unknown): Promise<ApiException> {
	try {
		await work();
	} catch (error) {
		return error as ApiException;
	}

	// Control: a call that answered instead of throwing fails here rather than leaving an `undefined`
	// for the assertions below to read as a pass.
	throw new Error('expected the write to be refused, and it answered instead');
}

afterEach(() => {
	jest.restoreAllMocks();
});

describe('a write that lands', () => {
	it('returns the next version and carries it in the patch beside the caller\'s columns', async () => {
		const { service, table } = serviceWith();
		const patch = { status: 'PAID', total: '10.000000' };

		const written = await commitVersionedUpdate(service, {
			id: 'invoice-1',
			expectation: { wildcard: false, versions: [3] },
			patch
		});

		expect(written).toEqual({ version: 4 });
		// `version` is this helper's to set and the caller's columns travel beside it — and nothing else
		// does: an id in the patch would be a column write nobody asked for.
		expect(table.patches[0]).toEqual({ status: 'PAID', total: '10.000000', version: 4 });
		// Control: the caller's own object is left as it was handed over. A helper that wrote `version`
		// into it would mutate a DTO the caller may still be holding, or reuse.
		expect(patch).toEqual({ status: 'PAID', total: '10.000000' });
		expect(patch).not.toHaveProperty('version');
	});

	it('overwrites a version the caller put in the patch', async () => {
		const { service, table } = serviceWith();

		await commitVersionedUpdate(service, {
			id: 'invoice-1',
			expectation: { wildcard: false, versions: [3] },
			patch: { status: 'PAID', version: 99 } as Record<string, unknown>
		});

		// Control: the version written is the one the update was predicated on, incremented. A caller able
		// to choose it could set the column backwards and make the next conditional write match a value
		// that no longer means anything.
		expect(table.patches[0]).toEqual({ status: 'PAID', version: 4 });
	});

	it('does not read a row whose version the caller already stated', async () => {
		const { service, table } = serviceWith();

		await commitVersionedUpdate(service, { id: 'invoice-1', expectation: { wildcard: false, versions: [3] }, patch: {} });

		// Control: a caller that stated exactly one version has answered the question, and a write that
		// landed needs no read-back. Each extra round trip here is another window to lose and another
		// statement to pay for.
		expect(table.reads).toEqual([]);
		expect(table.criteria).toHaveLength(1);
	});

	it('reads an answer that carries only the updated row as one row changed', async () => {
		const { service, table } = serviceWith({ answer: { id: 'invoice-1', status: 'PAID' } });

		const written = await commitVersionedUpdate(service, {
			id: 'invoice-1',
			expectation: { wildcard: false, versions: [3] },
			patch: {}
		});

		// The dual-ORM path may answer with a count or with the row. Control: reading the row-shaped answer
		// as "matched nothing" would turn every write into a false conflict and no write would ever land.
		expect(written).toEqual({ version: 4 });
		expect(table.reads).toEqual([]);
	});

	it('falls back to the row when the answer carries neither a count nor a row', async () => {
		const { service, table } = serviceWith({ answer: {} });
		const refusal = await refusalFrom(() =>
			commitVersionedUpdate(service, { id: 'invoice-1', expectation: { wildcard: false, versions: [3] }, patch: {} })
		);

		// An answer that says nothing about what happened is read as "nothing happened", and the read-back
		// is then what decides — which is the honest answer for a driver this build does not recognise.
		expect(refusal.getStatus()).toBe(409);
		expect(table.reads).toEqual(['invoice-1']);
	});
});

describe('the criteria the update is predicated on', () => {
	it('states the id, the version it was predicated on and every extra criterion the caller asked for', async () => {
		const { service, table } = serviceWith();

		await commitVersionedUpdate(service, {
			id: 'invoice-1',
			expectation: { wildcard: false, versions: [3] },
			patch: { status: 'PAID' },
			where: { tenantId: 'tenant-1', organizationId: 'org-1' }
		});

		// The version is in the `WHERE` rather than in a read that happened earlier, so the check and the
		// write are one statement — and the caller's own scope criteria ride along, so a write cannot be
		// predicated on a version and land across a tenant boundary.
		expect(table.criteria[0]).toEqual({
			id: 'invoice-1',
			version: 3,
			tenantId: 'tenant-1',
			organizationId: 'org-1'
		});
	});

	it('scopes the statement by the credential, whether or not the caller remembered to', async () => {
		// The scope is a property of the convention, not a line each route has to remember: before this
		// the tenant travelled only through `TenantAwareCrudService.update` and the organization travelled
		// only where a call site passed `where`, which was four call sites out of twenty-five. Control: a
		// write that reached a row of another organization was accepted, and a caller that forgot was
		// indistinguishable from one that meant it.
		const { service, table } = serviceWith();

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue('org-1');

		try {
			await commitVersionedUpdate(service, {
				id: 'invoice-1',
				expectation: { wildcard: false, versions: [3] },
				patch: { status: 'PAID' }
			});

			expect(table.criteria[0]).toEqual({
				id: 'invoice-1',
				version: 3,
				tenantId: 'tenant-1',
				organizationId: 'org-1'
			});
		} finally {
			jest.restoreAllMocks();
		}
	});

	it('leaves the scope out for a caller outside a request, rather than stating it as undefined', async () => {
		// A job, a seeder and an expiry sweep write rows they never read. A key present with an undefined
		// value is a criterion the two ORMs interpret differently, so the member is left out entirely.
		const { service, table } = serviceWith();

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(undefined);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(undefined);

		try {
			await commitVersionedUpdate(service, {
				id: 'invoice-1',
				expectation: { wildcard: false, versions: [3] },
				patch: { status: 'PAID' }
			});

			expect(table.criteria[0]).toEqual({ id: 'invoice-1', version: 3 });
		} finally {
			jest.restoreAllMocks();
		}
	});

	it('reserves the precondition, so an extra criterion cannot replace the version it was predicated on', async () => {
		const { service, table } = serviceWith();

		const written = await commitVersionedUpdate(service, {
			id: 'invoice-1',
			expectation: { wildcard: false, versions: [3] },
			patch: { status: 'PAID' },
			// A `where` naming the same column the precondition is built from, which is what a call site
			// that spreads a criteria object into `where` produces without meaning to.
			where: { version: 5 }
		});

		// The caller's criteria go in first and the two reserved columns last, so the statement is
		// predicated on the version this helper derived — 3 — and not on the number the caller happened to
		// carry in its scope criteria. Control: built the other way round the criteria would read
		// `version: 5`, and the write would report 4 for a statement that ran against 5.
		expect(table.criteria[0]).toEqual({ id: 'invoice-1', version: 3 });
		expect(written).toEqual({ version: 4 });
	});

	it('reserves the identifier too, so an extra criterion cannot retarget the write', async () => {
		const { service, table } = serviceWith();

		await commitVersionedUpdate(service, {
			id: 'invoice-1',
			expectation: { wildcard: false, versions: [3] },
			patch: { status: 'PAID' },
			where: { id: 'invoice-2', tenantId: 'tenant-1' }
		});

		// The same spread order protects the other reserved column: a write addressed by one identifier is
		// never quietly performed on another, however the caller assembled its criteria.
		expect(table.criteria[0]).toEqual({ tenantId: 'tenant-1', id: 'invoice-1', version: 3 });
	});
});

describe('an update that matched nothing', () => {
	it('answers a record that is gone as not found', async () => {
		const { service, table } = serviceWith({ answer: { affected: 0 }, row: null });
		const refusal = await refusalFrom(() =>
			commitVersionedUpdate(service, { id: 'invoice-1', expectation: { wildcard: false, versions: [3] }, patch: {} })
		);

		expect(refusal).toBeInstanceOf(ApiException);
		expect(refusal.getStatus()).toBe(404);
		expect(refusal.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
		expect(refusal.details).toEqual({ id: 'invoice-1' });
		// Control: the record is gone rather than moved on. Answering 409 would send the caller to re-read a
		// record that is not there, and to reapply a change to nothing.
		expect(table.reads).toEqual(['invoice-1']);
	});

	it('answers a read the service itself refuses as not found too', async () => {
		const { service } = serviceWith({ answer: { affected: 0 }, failure: new NotFoundException() });
		const refusal = await refusalFrom(() =>
			commitVersionedUpdate(service, { id: 'invoice-1', expectation: { wildcard: false, versions: [3] }, patch: {} })
		);

		// The ORM answers a read of a deleted row with its own not-found, which is the same fact as a row
		// that is simply absent.
		expect(refusal.getStatus()).toBe(404);
		expect(refusal.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
	});

	it('answers a record that has moved on as a conflict naming both versions', async () => {
		const { service } = serviceWith({ answer: { affected: 0 }, row: { id: 'invoice-1', version: 5 } });
		const refusal = await refusalFrom(() =>
			commitVersionedUpdate(service, { id: 'invoice-1', expectation: { wildcard: false, versions: [3] }, patch: {} })
		);

		expect(refusal.getStatus()).toBe(409);
		expect(refusal.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		// Control: the actual version is the whole diagnostic value of a conflict. A refusal that named only
		// what the caller expected would leave it re-reading to be told what it already knew.
		expect(refusal.details).toEqual({ expectedVersion: 3, actualVersion: 5 });
	});

	it('keeps the conflict when the read-back that would explain it fails', async () => {
		const { service, table } = serviceWith({
			answer: { affected: 0 },
			failure: new Error('connection terminated unexpectedly')
		});
		const refusal = await refusalFrom(() =>
			commitVersionedUpdate(service, { id: 'invoice-1', expectation: { wildcard: false, versions: [3] }, patch: {} })
		);

		// Control: the read-back is diagnostic. A helper that let its failure through would report a lost
		// update as a server fault — and one that named a version it never read would be inventing a number
		// the client would then send back as its next `If-Match`.
		expect(refusal.getStatus()).toBe(409);
		expect(refusal.code).toBe(ApiErrorCode.ENTITY_VERSION_CONFLICT);
		expect(refusal.details).toEqual({ expectedVersion: 3 });
		expect(refusal.details).not.toHaveProperty('actualVersion');
		expect(table.reads).toEqual(['invoice-1']);
	});
});

describe('the expectation the request carries', () => {
	it('reads the guard\'s own answer off the request', () => {
		// The guard validates the header and leaves what the caller accepted on the request, so the update
		// is predicated on the value the guard checked rather than on a second parse of the same header.
		expect(versionExpectationOf(accepted({ wildcard: false, versions: [3] }))).toEqual({
			wildcard: false,
			versions: [3]
		});
	});

	it('refuses a write whose request carries no accepted expectation', async () => {
		const requests = [
			undefined,
			null,
			{},
			// Present and empty is the same fact as absent: a write that ran on either would be an
			// unconditional overwrite wearing the guard's name.
			{ [VERSION_EXPECTATION_PROPERTY]: null },
			{ [VERSION_EXPECTATION_PROPERTY]: undefined }
		];

		for (const request of requests) {
			const refusal = await refusalFrom(() => versionExpectationOf(request));

			// An opt-in that silently degrades to last-write-wins is worse than no opt-in at all, because
			// the caller believes it is protected: this refusal is what makes the degradation impossible
			// rather than merely unlikely.
			expect(refusal).toBeInstanceOf(ApiException);
			expect(refusal.getStatus()).toBe(428);
			expect(refusal.code).toBe(ApiErrorCode.VERSION_REQUIRED);
			expect(refusal.details).toBeUndefined();
		}
	});

	it('predicates the update on the version the guard accepted', async () => {
		const { service, table } = serviceWith();

		const written = await commitVersionedUpdate(service, {
			id: 'invoice-1',
			expectation: versionExpectationOf(accepted({ wildcard: false, versions: [3] })),
			patch: { status: 'PAID' }
		});

		// The two halves meet here: what the guard left on the request is what the `WHERE` states, and the
		// write is refused outright when the guard never ran.
		expect(written).toEqual({ version: 4 });
		expect(table.criteria[0]).toEqual({ id: 'invoice-1', version: 3 });
	});
});

describe('an expectation that states a condition rather than a number', () => {
	it('resolves a wildcard to the version the record holds, and predicates the update on it', async () => {
		const { service, table } = serviceWith({ row: { id: 'invoice-1', version: 5 } });

		const written = await commitVersionedUpdate(service, {
			id: 'invoice-1',
			expectation: { wildcard: true, versions: [] },
			patch: { status: 'PAID' }
		});

		expect(written).toEqual({ version: 6 });
		expect(table.criteria[0]).toEqual({ id: 'invoice-1', version: 5 });
		// One read to resolve the wildcard and no read-back: the number came from the row and the update
		// landed on it, so `If-Match: *` is a conditional write rather than an unconditional one.
		expect(table.reads).toEqual(['invoice-1']);
	});

	it('resolves a list of accepted versions the same way', async () => {
		const { service, table } = serviceWith({ row: { id: 'invoice-1', version: 3 } });

		const written = await commitVersionedUpdate(service, {
			id: 'invoice-1',
			expectation: { wildcard: false, versions: [2, 3] },
			patch: {}
		});

		// A list states a condition rather than a number, so the number has to come from the row — and the
		// update is still predicated on it, which is what keeps the comparison and the write one statement
		// for a caller that named no single version.
		expect(table.criteria[0]).toEqual({ id: 'invoice-1', version: 3 });
		expect(written).toEqual({ version: 4 });
		expect(table.reads).toEqual(['invoice-1']);
	});

	it('reads the version through the reader the caller supplied', async () => {
		const { service, table } = serviceWith({ row: { id: 'invoice-1', version: 5 } });
		const readVersion = jest.fn(async () => 7);

		const written = await commitVersionedUpdate(service, {
			id: 'invoice-1',
			expectation: { wildcard: true, versions: [] },
			patch: {},
			readVersion
		});

		expect(written).toEqual({ version: 8 });
		expect(table.criteria[0]).toEqual({ id: 'invoice-1', version: 7 });
		// Control: a caller that already holds the row supplies the reader and does not pay for a second
		// query — and the version it supplied is still the one the statement is predicated on.
		expect(readVersion).toHaveBeenCalledTimes(1);
		expect(table.reads).toEqual([]);
	});

	it('does not attempt the update at all when the record cannot be resolved', async () => {
		const { service, table } = serviceWith({ row: null });
		const refusal = await refusalFrom(() =>
			commitVersionedUpdate(service, { id: 'invoice-1', expectation: { wildcard: true, versions: [] }, patch: {} })
		);

		expect(refusal.getStatus()).toBe(404);
		expect(refusal.code).toBe(ApiErrorCode.RESOURCE_NOT_FOUND);
		// Control: a wildcard names no version, so a row that is not there leaves nothing to predicate on.
		// Running the update anyway would be an unqualified write — the one statement this helper exists
		// to never make.
		expect(table.criteria).toEqual([]);
	});

	it('raises a wildcard whose version could not be read rather than calling the record missing', async () => {
		const failure = new Error('connection terminated unexpectedly');
		const { service, table } = serviceWith({ failure });
		const refusal = await refusalFrom(() =>
			commitVersionedUpdate(service, { id: 'invoice-1', expectation: { wildcard: true, versions: [] }, patch: {} })
		);

		// On this path the read is load-bearing rather than diagnostic: it is what supplies the number the
		// statement is predicated on. So a read that *failed* must not be reported as a record that is not
		// there — the caller would take the deleted-record path and stop retrying a row that still exists.
		// Control: the store's own failure is raised unchanged, so the platform's filter answers a server
		// error; answering 404 here is the one outcome that loses the row.
		expect(refusal).toBe(failure);
		expect(table.reads).toEqual(['invoice-1']);
		expect(table.criteria).toEqual([]);
	});
});

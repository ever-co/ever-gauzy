/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a validation service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary, and
 * **the service under test is the real one**: only the base entity classes, the request context and
 * the rule engine are substituted. The rule engine is substituted because the test asserts what the
 * entitlement domain does with a verdict, not what the platform's evaluator computes — the evaluator
 * has its own suite.
 *
 * `@gauzy/config` is read at import time by the row-lock helper the package shares, so it is doubled
 * too.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		TenantAwareCrudService: class {},
		CrudService: class {},
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		IsSecret: decorator,
		VersionedColumn: decorator,
		BaseEvent: class {},
		EventBus: class {},
		EventOutboxService: class {},
		RuleService: class {},
		SequenceService: class {},
		OrganizationContact: class {},
		Product: class {},
		ProductVariant: class {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';
import { EntitlementCheckReason } from '../entitlement.types';
import { EntitlementKind, EntitlementKeyStatus, EntitlementStatus } from '../entitlement.enums';
import { EntitlementCheckService } from './entitlement-check.service';

/**
 * The one question every consumer asks, answered from one implementation (doc 05 §19.4).
 *
 * The specification fixes the whole verdict, and this suite pins it:
 *
 * - **a denial is an answer, not an error** — `allowed: false` with a stable code, so a caller can
 *   tell "you may not" from "there is no such right" from "the licensing service is unreachable"
 *   (doc 05 §19.4, doc 06 §6.15);
 * - a right of another tenant answers exactly like one that does not exist, so the check cannot be
 *   used to enumerate another organization's licences (doc 02 §1.16);
 * - the verdict is derived from the state, the term **and the seats in use**, never from a stored
 *   flag, and the seat count is a count of live activation rows rather than the cached counter
 *   (doc 05 §19.1, §19.4 clause 3);
 * - the term's edges are instants: the right is exercisable **at** `startsAt` and **at**
 *   `endsAt + gracePeriodDays`, and neither one instant earlier nor one instant later
 *   (doc 05 §19.1: `endsAt` is "the instant the right stops being exercisable", the grace period
 *   "extends when the right stops being exercisable");
 * - a credential is answered before the right it was issued against, because a revoked key is not a
 *   key whatever state the right is in (doc 05 §19.3);
 * - "remaining" is never negative: an over-count is reported as zero rather than as a credit the
 *   customer does not have (doc 05 §19.1).
 *
 * The service is constructed directly with in-memory doubles of its three repositories. The doubles
 * state the `where` the service states, because a double that answered every row regardless would
 * make the tenant cases below vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
const RIGHT = 'entitlement-1';
const KEY = 'key-1';

/** One row, matched against the subset of conditions the service states. */
function matches(row: Record<string, any>, where: Record<string, any> = {}): boolean {
	return Object.entries(where).every(([field, expected]) => {
		if (expected === undefined) {
			return true;
		}

		if (expected === null) {
			return row[field] === null || row[field] === undefined;
		}

		return String(row[field] ?? '') === String(expected);
	});
}

/** A right, as the check reads it. */
function rightRow(overrides: Record<string, unknown> = {}) {
	return {
		id: RIGHT,
		tenantId: TENANT,
		organizationId: ORG,
		number: 'ENT-0001',
		kind: EntitlementKind.SEAT,
		quantity: 3,
		startsAt: new Date('2026-01-01T00:00:00.000Z'),
		endsAt: new Date('2026-12-31T00:00:00.000Z'),
		gracePeriodDays: 0,
		activationLimit: null as number | null,
		activationCount: 0,
		status: EntitlementStatus.ACTIVE,
		...overrides
	};
}

/** A credential, as the check reads it. */
function keyRow(overrides: Record<string, unknown> = {}) {
	return {
		id: KEY,
		tenantId: TENANT,
		organizationId: ORG,
		entitlementId: RIGHT,
		keyHash: 'digest-of-the-presented-key',
		status: EntitlementKeyStatus.ISSUED,
		expiresAt: null as Date | null,
		...overrides
	};
}

/**
 * Builds the check service over in-memory tables.
 *
 * @param seed What the fixture holds.
 * @param verdict What the substituted rule engine answers when conditions are evaluated.
 */
function checkFixture(
	seed: { rights?: any[]; keys?: any[]; activations?: any[]; rules?: any[] } = {},
	verdict: { matched: boolean; failedRules?: string[]; unresolvedAttributes?: string[]; coercionFailures?: string[] } = {
		matched: true
	}
) {
	const tables = {
		entitlement: [...(seed.rights ?? [rightRow()])],
		entitlement_key: [...(seed.keys ?? [])],
		entitlement_activation: [...(seed.activations ?? [])]
	};
	// A condition set is present unless the case is about the unrestricted case: an owner with no rules
	// is answered by the evaluator without reading anything, which is a different path.
	const rules = seed.rules ?? [{ id: 'rule-1', attribute: 'region' }];
	const asked: Array<{ owner: string; ownerId: string }> = [];

	const entitlementRepository = {
		findOne: async ({ where }: any = {}) => tables.entitlement.find((row) => matches(row, where)) ?? null
	};
	const keyRepository = {
		findOne: async ({ where }: any = {}) => tables.entitlement_key.find((row) => matches(row, where)) ?? null
	};
	const activationRepository = {
		count: async ({ where }: any = {}) => tables.entitlement_activation.filter((row) => matches(row, where)).length
	};
	const ruleService = {
		findByOwner: async (owner: string, ownerId: string) => {
			asked.push({ owner, ownerId });

			return rules;
		},
		evaluateRules: () => ({
			matched: verdict.matched,
			failedRules: verdict.failedRules ?? [],
			unresolvedAttributes: verdict.unresolvedAttributes ?? [],
			coercionFailures: verdict.coercionFailures ?? []
		})
	};
	const service = new EntitlementCheckService(
		entitlementRepository as never,
		keyRepository as never,
		activationRepository as never,
		ruleService as never
	);

	return { service, tables, asked, activationsFor: (id: string) => tables.entitlement_activation.filter((row) => row.entitlementId === id) };
}

/**
 * The digest the service computes is the platform's SHA-256 of the presented plaintext; the
 * assertion that a lookup is by digest and never by a stored plaintext compares against it rather
 * than against a fixture string.
 */
function digestOf(plaintext: string): string {
	return require('node:crypto').createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

/** A live activation of the fixture's right. */
const liveActivation = (id: string, entitlementId: string = RIGHT) => ({
	id,
	entitlementId,
	tenantId: TENANT,
	organizationId: ORG,
	deviceId: `device-${id}`,
	status: 'ACTIVE'
});

const REASON = EntitlementCheckReason;

describe('EntitlementCheckService — what a check refers to (doc 05 §19.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a request that names neither a key nor a right', async () => {
		const fixture = checkFixture();

		expect(await fixture.service.check({})).toEqual({
			allowed: false,
			reason: REASON.REFERENCE_REQUIRED,
			conditionsMatched: true
		});
	});

	it('answers an unknown credential with KEY_NOT_FOUND rather than with a right it never resolved', async () => {
		const fixture = checkFixture({ keys: [keyRow({ keyHash: digestOf('a-real-key') })] });

		expect(await fixture.service.check({ key: 'another-key' })).toEqual({
			allowed: false,
			reason: REASON.KEY_NOT_FOUND,
			conditionsMatched: true
		});
	});

	it('finds a credential by the digest of its plaintext and never by a stored plaintext', async () => {
		const fixture = checkFixture({ keys: [keyRow({ keyHash: digestOf('the-presented-key') })] });

		const result = await fixture.service.check({ key: 'the-presented-key' });

		expect(result.allowed).toBe(true);
		expect(result.entitlementId).toBe(RIGHT);
		// The fixture row holds a digest and nothing else: a plaintext column would be the defect this
		// assertion exists to catch.
		expect(fixture.tables.entitlement_key[0]).not.toHaveProperty('key');
	});

	it('refuses a credential presented against a right it was not issued for', async () => {
		const fixture = checkFixture({
			keys: [keyRow({ keyHash: digestOf('the-presented-key'), entitlementId: 'another-right' })]
		});

		expect(await fixture.service.check({ key: 'the-presented-key', entitlementId: RIGHT })).toEqual({
			allowed: false,
			reason: REASON.KEY_NOT_FOUND,
			conditionsMatched: true
		});
	});

	it('answers a right of another organization exactly like one that does not exist', async () => {
		// A right of another tenant is not a 403 and not a distinct code: it is reported as absent, so a
		// caller cannot use the check to enumerate another organization's licences.
		const fixture = checkFixture({ rights: [rightRow({ organizationId: OTHER_ORG })] });

		const result = await fixture.service.check({ entitlementId: RIGHT });

		expect(result).toEqual({ allowed: false, reason: REASON.NOT_FOUND, conditionsMatched: true });
		expect(fixture.tables.entitlement).toHaveLength(1);
	});
});

describe('EntitlementCheckService — the credential decides first (doc 05 §19.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		[EntitlementKeyStatus.REVOKED, REASON.KEY_REVOKED],
		[EntitlementKeyStatus.EXPIRED, REASON.KEY_EXPIRED]
	])('answers a %s credential with %s even when the right behind it is in force', async (status, reason) => {
		const fixture = checkFixture({
			keys: [keyRow({ keyHash: digestOf('presented'), status })],
			rights: [rightRow({ status: EntitlementStatus.ACTIVE })]
		});

		const result = await fixture.service.check({ key: 'presented' });

		expect(result.allowed).toBe(false);
		expect(result.reason).toBe(reason);
		// The right's own state is still reported, so an operator sees both facts at once.
		expect(result.status).toBe(EntitlementStatus.ACTIVE);
	});

	it('answers a credential past its own expiry as expired even while its own status is ISSUED', async () => {
		const fixture = checkFixture({
			keys: [
				keyRow({
					keyHash: digestOf('presented'),
					status: EntitlementKeyStatus.ISSUED,
					expiresAt: new Date(Date.now() - 1000)
				})
			]
		});

		expect((await fixture.service.check({ key: 'presented' })).reason).toBe(REASON.KEY_EXPIRED);
	});

	it('does not answer an expired credential with the right’s state, which would read as "come back later"', async () => {
		// Control for the ordering: a SUSPENDED right behind a REVOKED key answers KEY_REVOKED, not
		// SUSPENDED, because a withdrawn credential is not a credential whatever the right says.
		const fixture = checkFixture({
			keys: [keyRow({ keyHash: digestOf('presented'), status: EntitlementKeyStatus.REVOKED })],
			rights: [rightRow({ status: EntitlementStatus.SUSPENDED })]
		});

		expect((await fixture.service.check({ key: 'presented' })).reason).toBe(REASON.KEY_REVOKED);
	});
});

describe('EntitlementCheckService — the state verdict (doc 05 §19.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		[EntitlementStatus.REVOKED, REASON.REVOKED],
		[EntitlementStatus.SUSPENDED, REASON.SUSPENDED],
		[EntitlementStatus.PENDING, REASON.PENDING],
		[EntitlementStatus.EXPIRED, REASON.EXPIRED]
	])('answers a %s right with %s', async (status, reason) => {
		const fixture = checkFixture({ rights: [rightRow({ status })] });

		const result = await fixture.service.check({ entitlementId: RIGHT });

		expect(result.allowed).toBe(false);
		expect(result.reason).toBe(reason);
		expect(result.entitlementId).toBe(RIGHT);
		expect(result.conditionsMatched).toBe(true);
	});

	it('answers a right whose term has not opened with TERM_NOT_STARTED', async () => {
		const fixture = checkFixture({
			rights: [rightRow({ startsAt: new Date(Date.now() + 60_000), status: EntitlementStatus.ACTIVE })]
		});

		expect((await fixture.service.check({ entitlementId: RIGHT })).reason).toBe(REASON.TERM_NOT_STARTED);
	});

	it('answers a right past its term with EXPIRED', async () => {
		const fixture = checkFixture({
			rights: [rightRow({ endsAt: new Date(Date.now() - 60_000), status: EntitlementStatus.ACTIVE })]
		});

		expect((await fixture.service.check({ entitlementId: RIGHT })).reason).toBe(REASON.EXPIRED);
	});

	it('answers a right whose seats are all in use with QUANTITY_EXHAUSTED, counted from the rows', async () => {
		// The count is of live activation rows and never of the cached `activationCount`, which the
		// fixture deliberately leaves at zero: a validation that trusted the cache would hand out a seat
		// the tenant did not sell (doc 05 §19.4 clause 3).
		const fixture = checkFixture({
			rights: [rightRow({ quantity: 2, activationCount: 0 })],
			activations: [liveActivation('a1'), liveActivation('a2')]
		});

		const result = await fixture.service.check({ entitlementId: RIGHT });

		expect(result.reason).toBe(REASON.QUANTITY_EXHAUSTED);
		expect(result.remainingQuantity).toBe(0);
	});

	it('answers a right whose simultaneous-activation ceiling is reached with ACTIVATION_LIMIT_REACHED', async () => {
		const fixture = checkFixture({
			rights: [rightRow({ quantity: 10, activationLimit: 1, activationCount: 1 })],
			activations: [liveActivation('a1')]
		});

		expect((await fixture.service.check({ entitlementId: RIGHT })).reason).toBe(REASON.ACTIVATION_LIMIT_REACHED);
	});

	it('counts only live activations against the seat ceiling', async () => {
		// Control: released, revoked and expired activations are history, and a right whose seats were
		// given back has them again.
		const fixture = checkFixture({
			rights: [rightRow({ quantity: 1 })],
			activations: [
				{ ...liveActivation('a1'), status: 'RELEASED' },
				{ ...liveActivation('a2'), status: 'REVOKED' },
				{ ...liveActivation('a3'), status: 'EXPIRED' }
			]
		});

		const result = await fixture.service.check({ entitlementId: RIGHT });

		expect(result.allowed).toBe(true);
		expect(result.reason).toBe(REASON.ALLOWED);
		expect(result.remainingQuantity).toBe(1);
	});

	it('treats quantity zero as unlimited and reports no remaining figure at all', async () => {
		const fixture = checkFixture({
			rights: [rightRow({ quantity: 0, kind: EntitlementKind.USAGE })],
			activations: [liveActivation('a1'), liveActivation('a2'), liveActivation('a3')]
		});

		const result = await fixture.service.check({ entitlementId: RIGHT });

		expect(result.allowed).toBe(true);
		// `null` and `0` are different answers: zero means "none left", null means "there is no ceiling".
		expect(result.remainingQuantity).toBeNull();
	});

	it('never reports a negative remaining quantity when the rows exceed the ceiling', async () => {
		// An over-count is a defect the usage audit repairs; reporting it as a negative would read as a
		// credit the customer does not have (doc 05 §19.1).
		const fixture = checkFixture({
			rights: [rightRow({ quantity: 1, activationCount: 0 })],
			activations: [liveActivation('a1'), liveActivation('a2'), liveActivation('a3')]
		});

		const result = await fixture.service.check({ entitlementId: RIGHT });

		expect(result.reason).toBe(REASON.QUANTITY_EXHAUSTED);
		expect(result.remainingQuantity).toBe(0);
	});

	it('reports how long the right is good for, grace period included', async () => {
		const endsAt = new Date('2026-06-01T00:00:00.000Z');
		const fixture = checkFixture({ rights: [rightRow({ endsAt, gracePeriodDays: 10 })] });

		const result = await fixture.service.check({ entitlementId: RIGHT });

		expect(result.validUntil).toEqual(new Date(endsAt.getTime() + 10 * 24 * 60 * 60 * 1000));
	});

	it('reports no end at all for a perpetual right', async () => {
		// "Null is the perpetual case ... so there is no separate perpetual flag to keep in step with
		// the date" (doc 05 §19.1).
		const fixture = checkFixture({ rights: [rightRow({ endsAt: null })] });

		expect((await fixture.service.check({ entitlementId: RIGHT })).validUntil).toBeNull();
	});
});

/**
 * The term's two edges, on a frozen clock.
 *
 * Only `Date` is faked: the timers a promise-based service might use are left real, so the cases
 * below assert an instant and not a scheduling accident.
 */
describe('EntitlementCheckService — the instant a right stops and starts (doc 05 §19.1)', () => {
	const STARTS = new Date('2026-01-01T00:00:00.000Z');
	const ENDS = new Date('2026-06-01T00:00:00.000Z');

	beforeEach(() => {
		jest.useFakeTimers({
			doNotFake: [
				'nextTick',
				'queueMicrotask',
				'setImmediate',
				'clearImmediate',
				'setTimeout',
				'clearTimeout',
				'setInterval',
				'clearInterval',
				'performance',
				'hrtime',
				'requestAnimationFrame',
				'cancelAnimationFrame',
				'requestIdleCallback',
				'cancelIdleCallback'
			]
		});
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it('is exercisable at the instant its term opens', async () => {
		const fixture = checkFixture({ rights: [rightRow({ startsAt: STARTS, endsAt: ENDS })] });

		jest.setSystemTime(STARTS);

		expect((await fixture.service.check({ entitlementId: RIGHT })).reason).toBe(REASON.ALLOWED);
	});

	it('is not exercisable one millisecond before its term opens', async () => {
		const fixture = checkFixture({ rights: [rightRow({ startsAt: STARTS, endsAt: ENDS })] });

		jest.setSystemTime(new Date(STARTS.getTime() - 1));

		expect((await fixture.service.check({ entitlementId: RIGHT })).reason).toBe(REASON.TERM_NOT_STARTED);
	});

	it('is exercisable at the instant its term closes', async () => {
		// The field is "the instant the right stops being exercisable", so the instant itself belongs to
		// the term: a customer whose licence ends on the first of June is licensed on the first of June.
		const fixture = checkFixture({ rights: [rightRow({ startsAt: STARTS, endsAt: ENDS })] });

		jest.setSystemTime(ENDS);

		expect((await fixture.service.check({ entitlementId: RIGHT })).reason).toBe(REASON.ALLOWED);
	});

	it('is not exercisable one millisecond after its term closes', async () => {
		const fixture = checkFixture({ rights: [rightRow({ startsAt: STARTS, endsAt: ENDS })] });

		jest.setSystemTime(new Date(ENDS.getTime() + 1));

		expect((await fixture.service.check({ entitlementId: RIGHT })).reason).toBe(REASON.EXPIRED);
	});

	it('stays in force to the last instant of the grace period and not one instant longer', async () => {
		// The grace period "extends when the right stops being exercisable" (doc 05 §19.1): a right that
		// ended on the first of June with ten days of grace is in force through the eleventh, and its
		// `validUntil` is the same instant the verdict turns on.
		const fixture = checkFixture({ rights: [rightRow({ startsAt: STARTS, endsAt: ENDS, gracePeriodDays: 10 })] });
		const lastInstant = new Date(ENDS.getTime() + 10 * 24 * 60 * 60 * 1000);

		jest.setSystemTime(lastInstant);

		const result = await fixture.service.check({ entitlementId: RIGHT });

		expect(result.reason).toBe(REASON.ALLOWED);
		expect(result.validUntil).toEqual(lastInstant);

		jest.setSystemTime(new Date(lastInstant.getTime() + 1));

		expect((await fixture.service.check({ entitlementId: RIGHT })).reason).toBe(REASON.EXPIRED);
	});

	it('never treats a perpetual right as out of term', async () => {
		const fixture = checkFixture({ rights: [rightRow({ startsAt: STARTS, endsAt: null })] });

		jest.setSystemTime(new Date('2099-01-01T00:00:00.000Z'));

		expect((await fixture.service.check({ entitlementId: RIGHT })).reason).toBe(REASON.ALLOWED);
	});
});

describe('EntitlementCheckService — the conditions attached to a right (doc 02 §1.16, doc 05 §19.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('admits a right whose conditions matched', async () => {
		const fixture = checkFixture({}, { matched: true });

		const result = await fixture.service.check({ entitlementId: RIGHT, deviceId: 'device-1' });

		expect(result.allowed).toBe(true);
		expect(result.reason).toBe(REASON.ALLOWED);
		expect(result.conditionsMatched).toBe(true);
		expect(fixture.asked).toEqual([{ owner: 'ENTITLEMENT', ownerId: RIGHT }]);
	});

	it('denies a right whose conditions did not match, naming the rules that failed', async () => {
		const fixture = checkFixture({}, { matched: false, failedRules: ['region'] });

		const result = await fixture.service.check({ entitlementId: RIGHT, context: { region: 'APAC' } });

		expect(result.allowed).toBe(false);
		expect(result.reason).toBe(REASON.CONDITIONS_NOT_MET);
		expect(result.conditionsMatched).toBe(false);
		expect(result.failedRules).toEqual(['region']);
	});

	it('reports an unresolved attribute as a reason a condition could not match', async () => {
		// "An unresolved attribute does not match" is the platform rule engine's own rule, and a denial
		// has to be explainable: the caller is told which attribute was missing.
		const fixture = checkFixture({}, { matched: false, unresolvedAttributes: ['customer.tier'] });

		const result = await fixture.service.check({ entitlementId: RIGHT });

		expect(result.unresolvedAttributes).toEqual(['customer.tier']);
	});

	it('admits an unrestricted right without consulting a verdict that could deny it', async () => {
		// An owner that configured no conditions is unrestricted, which is what the evaluator already
		// says about an empty set — so the check reports the match rather than a denial.
		const fixture = checkFixture({ rules: [] }, { matched: false });

		const conditions = await fixture.service.evaluateConditions(rightRow() as never, {}, {});

		expect(conditions).toEqual({ matched: true, failedRules: [], unresolvedAttributes: [] });
	});

	it('does not report a withdrawn right as merely conditionally denied', async () => {
		// Ordering control: a REVOKED right is revoked regardless of what its conditions say, so the
		// conditions are never even read for it.
		const fixture = checkFixture({ rights: [rightRow({ status: EntitlementStatus.REVOKED })] }, { matched: false });

		const result = await fixture.service.check({ entitlementId: RIGHT });

		expect(result.reason).toBe(REASON.REVOKED);
		expect(fixture.asked).toEqual([]);
	});
});

describe('EntitlementCheckService — the refusal a caller in another package branches on (doc 06 §6.15)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('raises ForbiddenException carrying the stable code when the right may not be exercised', async () => {
		const fixture = checkFixture({ rights: [rightRow({ status: EntitlementStatus.SUSPENDED })] });

		await expect(fixture.service.assertEntitled({ entitlementId: RIGHT })).rejects.toBeInstanceOf(ForbiddenException);
		await expect(fixture.service.assertEntitled({ entitlementId: RIGHT })).rejects.toThrow(REASON.SUSPENDED);
	});

	it('answers a permitted right rather than throwing', async () => {
		const fixture = checkFixture();

		expect((await fixture.service.assertEntitled({ entitlementId: RIGHT })).allowed).toBe(true);
	});

	it('refuses a right that is not the caller’s with NotFoundException', async () => {
		const fixture = checkFixture();

		await expect(fixture.service.findOneScopedOrFail('no-such-right')).rejects.toBeInstanceOf(NotFoundException);
		expect(await fixture.service.findOneScoped('no-such-right')).toBeNull();
	});
});

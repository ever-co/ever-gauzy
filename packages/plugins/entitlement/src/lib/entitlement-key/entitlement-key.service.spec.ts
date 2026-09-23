/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a credential service needs and none of which is
 * available outside a running application. The seam is therefore doubled at the module boundary and
 * **the service under test is the real one**, including the real key material module: the digest, the
 * ciphertext and the generators are the ones a deployment runs, because the assertions below are
 * about what those functions produce and never about whether they were called.
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

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';
import { Entitlement } from '../entitlement/entitlement.entity';
import { EntitlementActivation } from '../entitlement-activation/entitlement-activation.entity';
import { EntitlementKey } from './entitlement-key.entity';
import { EntitlementActivationStatus, EntitlementKeyStatus, EntitlementStatus, LicenceKeyFormat } from '../entitlement.enums';
import { digestLicenceKey } from './licence-key';
import { EntitlementKeyService } from './entitlement-key.service';

/**
 * The credentials issued against a right, and their whole lifecycle (doc 05 §19.3).
 *
 * The specification fixes five properties, and each is pinned here as behaviour rather than as a
 * description:
 *
 * - **the plaintext leaves the service exactly once** — it is returned by the call that issued it and
 *   appears in no column, no event payload and no log line (doc 05 §19.3);
 * - **the lookup column is the digest**, computed once at issuance, so validation is one indexed probe
 *   and never a decryption (doc 05 §19.3, §19.4 clause 1);
 * - **a key is issued only against a right that is `PENDING` or `ACTIVE`**, because a credential
 *   issued against a right that cannot be activated is a credential that cannot work (§19.3);
 * - **revoking a key releases its activations and re-derives the counters but does not revoke the
 *   right** — the right and the credential are different things (§19.3);
 * - **a key is never re-assigned to a second holder**: reassignment is a new key, so "who was given
 *   key X" has one answer forever (§19.3).
 *
 * The service is constructed directly with in-memory doubles of its repositories. The doubles state
 * the `where` the service states, because a double that answered every row regardless would make the
 * tenant cases below vacuous.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const RIGHT = 'entitlement-1';

/** The subset of conditions the service states, matched the way the database would. */
function matches(row: Record<string, any>, where: Record<string, any> = {}): boolean {
	return Object.entries(where).every(([field, expected]) => {
		if (expected === undefined) {
			return true;
		}

		if (expected === null) {
			return row[field] === null || row[field] === undefined;
		}

		// `Not(...)` arrives as a TypeORM operator: the double implements the one the service builds.
		if (expected && typeof expected === 'object' && (expected as any).type === 'not') {
			return String(row[field] ?? '') !== String((expected as any).value ?? '');
		}

		return String(row[field] ?? '') === String(expected);
	});
}

/** The right a key is issued against. */
const rightRow = (overrides: Record<string, unknown> = {}) => ({
	id: RIGHT,
	tenantId: TENANT,
	organizationId: ORG,
	number: 'ENT-0001',
	status: EntitlementStatus.ACTIVE,
	quantity: 3,
	activationCount: 0,
	...overrides
});

/** One issued credential. */
const keyRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	entitlementId: RIGHT,
	keyHash: digestLicenceKey(`plaintext-${id}`),
	keyPrefix: `plaintex`,
	keyCiphertext: null,
	format: LicenceKeyFormat.UUID,
	status: EntitlementKeyStatus.ISSUED,
	activationCount: 0,
	assignedAt: null,
	assignedToEmail: null,
	assignedToCustomerId: null,
	activationLimit: null,
	expiresAt: null,
	metadata: null,
	...overrides
});

/** One activation, as the counter re-derivation reads it. */
const activationRow = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	entitlementId: RIGHT,
	entitlementKeyId: null,
	tenantId: TENANT,
	organizationId: ORG,
	deviceId: `device-${id}`,
	status: EntitlementActivationStatus.ACTIVE,
	...overrides
});

/**
 * Builds the key service over in-memory tables.
 *
 * @param seed What the fixture holds.
 */
function keyFixture(seed: { rights?: any[]; keys?: any[]; activations?: any[]; sequence?: number } = {}) {
	let sequence = seed.sequence ?? 0;
	const tables = {
		entitlement: [...(seed.rights ?? [rightRow()])],
		entitlement_key: [...(seed.keys ?? [])],
		entitlement_activation: [...(seed.activations ?? [])]
	};
	const appended: any[] = [];
	/** The tables the manager writes, keyed by the entity class the service names. */
	const tableOf = (entity: unknown): any[] => {
		if (entity === EntitlementActivation) {
			return tables.entitlement_activation;
		}

		if (entity === Entitlement) {
			return tables.entitlement;
		}

		if (entity === EntitlementKey) {
			return tables.entitlement_key;
		}

		throw new Error('the in-memory double was handed an entity it does not know');
	};

	const manager: any = {
		create: (_entity: unknown, partial: Record<string, any>) => ({ ...partial }),
		save: async (entity: unknown, rowOrRows: any) => {
			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
			const table = tableOf(entity);

			for (const row of list) {
				const index = row.id ? table.findIndex((candidate) => candidate.id === row.id) : -1;

				if (index >= 0) {
					table[index] = { ...table[index], ...row };
					continue;
				}

				if (!row.id) {
					row.id = `generated-${++sequence}`;
				}

				table.push(row);
			}

			return Array.isArray(rowOrRows) ? list : list[0];
		},
		find: async (entity: unknown, options: any = {}) => tableOf(entity).filter((row) => matches(row, options.where)),
		findOne: async (entity: unknown, options: any = {}) =>
			tableOf(entity).find((row) => matches(row, options.where)) ?? null,
		count: async (entity: unknown, options: any = {}) =>
			tableOf(entity).filter((row) => matches(row, options.where)).length,
		update: async (entity: unknown, criteria: any, patch: Record<string, any>) => {
			const row = tableOf(entity).find((candidate) => matches(candidate, criteria));

			if (row) {
				Object.assign(row, patch);
			}

			return { affected: row ? 1 : 0 };
		},
		softDelete: async () => ({ affected: 0 }),
		/** The transaction the issuance and the revocation write through; the doubles are synchronous. */
		transaction: async (run: (transactional: any) => Promise<any>) => await run(manager)
	};

	const keyRepository: any = {
		manager,
		create: (partial: Record<string, any>) => ({ ...partial }),
		save: async (row: any) => await manager.save(EntitlementKey, row),
		update: async (criteria: any, patch: Record<string, any>) => manager.update(EntitlementKey, criteria, patch),
		findOne: async ({ where }: any = {}) => tables.entitlement_key.find((row) => matches(row, where)) ?? null,
		find: async ({ where, order }: any = {}) => {
			const found = tables.entitlement_key.filter((row) => matches(row, where));

			if (order?.createdAt === 'DESC') {
				return [...found].reverse();
			}

			return found;
		}
	};
	const entitlementRepository: any = {
		findOne: async ({ where }: any = {}) => tables.entitlement.find((row) => matches(row, where)) ?? null
	};
	const outbox = {
		append: async (_manager: unknown, event: any) => {
			appended.push(event);

			return event;
		}
	};
	const service = new EntitlementKeyService(
		keyRepository,
		{} as never,
		entitlementRepository,
		outbox as never
	);

	return {
		service,
		manager,
		tables,
		appended,
		events: () => appended.map((event) => event.name),
		store: (id: string) => tables.entitlement_key.find((row) => row.id === id)
	};
}

describe('EntitlementKeyService — issuance (doc 05 §19.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('stores a digest and a prefix, and returns the plaintext exactly once', async () => {
		const fixture = keyFixture();

		const { key, plaintext } = await fixture.service.issue({ entitlementId: RIGHT });

		expect(plaintext).toHaveLength(36); // the canonical UUID the default format renders
		expect(key.keyHash).toBe(digestLicenceKey(plaintext));
		expect(key.keyPrefix).toBe(plaintext.slice(0, 8));
		expect(key.status).toBe(EntitlementKeyStatus.ISSUED);
		expect(key.activationCount).toBe(0);
		// The plaintext is in no column of the stored row: the digest and the prefix are all that is kept.
		expect(JSON.stringify(fixture.store(key.id))).not.toContain(plaintext);
	});

	it('writes no event that carries the plaintext', async () => {
		const fixture = keyFixture();

		const { key, plaintext } = await fixture.service.issue({ entitlementId: RIGHT, assignedToEmail: 'buyer@example.com' });

		expect(fixture.events()).toEqual(['entitlement_key.issued']);
		expect(fixture.appended[0].data).toMatchObject({
			keyId: key.id,
			entitlementId: RIGHT,
			keyPrefix: key.keyPrefix,
			assignedToEmail: 'buyer@example.com'
		});
		expect(JSON.stringify(fixture.appended)).not.toContain(plaintext);
	});

	it('issues a write-only key by default and a recoverable one only when it was asked for', async () => {
		const plain = keyFixture();
		const recoverable = keyFixture();

		const writeOnly = await plain.service.issue({ entitlementId: RIGHT });

		expect(writeOnly.key.keyCiphertext).toBeNull();
		await expect(plain.service.reveal(writeOnly.key.id)).rejects.toThrow(/ENTITLEMENT_KEY_NOT_RECOVERABLE/);

		const stored = await recoverable.service.issue({ entitlementId: RIGHT, storeKey: true });

		expect(stored.key.keyCiphertext).toBeTruthy();
		// The key can be re-displayed only because a ciphertext was written, and what comes back is the
		// key that was issued — never a different one.
		expect(await recoverable.service.reveal(stored.key.id)).toBe(stored.plaintext);
	});

	it.each([
		[LicenceKeyFormat.UUID, /^[0-9a-f-]{36}$/],
		[LicenceKeyFormat.GROUPED_16, /^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){3}$/],
		[LicenceKeyFormat.BASE32_20, /^[2-9A-HJ-NP-Z]{4}(-[2-9A-HJ-NP-Z]{4}){4}$/]
	])('renders a %s key in the documented shape', async (format, shape) => {
		const fixture = keyFixture();

		const { key, plaintext } = await fixture.service.issue({ entitlementId: RIGHT, format });

		expect(plaintext).toMatch(shape);
		expect(key.format).toBe(format);
	});

	it.each([
		[EntitlementStatus.REVOKED],
		[EntitlementStatus.EXPIRED],
		[EntitlementStatus.SUSPENDED]
	])('refuses to issue against a right that is %s', async (status) => {
		const fixture = keyFixture({ rights: [rightRow({ status })] });

		await expect(fixture.service.issue({ entitlementId: RIGHT })).rejects.toBeInstanceOf(BadRequestException);
		await expect(fixture.service.issue({ entitlementId: RIGHT })).rejects.toThrow(/ENTITLEMENT_KEY_NOT_ISSUABLE/);
		expect(fixture.tables.entitlement_key).toEqual([]);
	});

	it('refuses to issue against a right that is not the caller’s', async () => {
		const fixture = keyFixture({ rights: [] });

		await expect(fixture.service.issue({ entitlementId: RIGHT })).rejects.toBeInstanceOf(NotFoundException);
		expect(fixture.tables.entitlement_key).toEqual([]);
	});
});

describe('EntitlementKeyService — the lookup and the holder (doc 05 §19.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('finds a key by the digest of its plaintext and answers null for a key this organization never issued', async () => {
		const fixture = keyFixture({ keys: [keyRow('k1', { keyHash: digestLicenceKey('issued-key') })] });

		expect((await fixture.service.findByPlaintext('issued-key'))?.id).toBe('k1');
		expect(await fixture.service.findByPlaintext('another-key')).toBeNull();
	});

	it('refuses to re-assign a key to a second holder', async () => {
		const fixture = keyFixture({ keys: [keyRow('k1', { assignedToEmail: 'first@example.com', assignedAt: new Date() })] });

		await expect(fixture.service.assign('k1', { assignedToEmail: 'second@example.com' })).rejects.toThrow(
			/ENTITLEMENT_KEY_ALREADY_ASSIGNED/
		);
		expect(fixture.store('k1').assignedToEmail).toBe('first@example.com');
	});

	it('accepts the holder it already has, whatever the case of the address', async () => {
		// Control for the refusal above: re-stating the same holder is not a re-assignment, and an
		// address is the same address whatever case it was typed in.
		const fixture = keyFixture({ keys: [keyRow('k1', { assignedToEmail: 'Buyer@Example.com' })] });

		const assigned = await fixture.service.assign('k1', { assignedToEmail: 'buyer@example.com' });

		expect(assigned.assignedToCustomerId).toBeNull();
		expect(assigned.assignedAt).toBeTruthy();
	});

	it('records a holder on a key that had none and keeps the holder it had', async () => {
		const fixture = keyFixture({ keys: [keyRow('k1', { assignedToCustomerId: 'customer-1' })] });

		const assigned = await fixture.service.assign('k1', { assignedToEmail: 'buyer@example.com' });

		expect(assigned).toMatchObject({ assignedToEmail: 'buyer@example.com', assignedToCustomerId: 'customer-1' });
	});

	it('reads a key of another organization as missing', async () => {
		const fixture = keyFixture({
			keys: [keyRow('k1', { organizationId: '00000000-0000-4000-8000-000000000099' })]
		});

		await expect(fixture.service.findOneScoped('k1')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('EntitlementKeyService — consumption (doc 05 §19.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('marks a live key as activated exactly once', async () => {
		// "A key is activated at most once" (doc 05 §19.3): the first consumption moves it, the second is
		// refused rather than silently accepted.
		const fixture = keyFixture({ keys: [keyRow('k1')] });
		const key = fixture.store('k1') as any;

		await fixture.service.consume(fixture.manager, key);

		expect(fixture.store('k1').status).toBe(EntitlementKeyStatus.ACTIVATED);
		await expect(fixture.service.consume(fixture.manager, key)).rejects.toThrow(/ENTITLEMENT_KEY_USED/);
	});

	it.each([
		[EntitlementKeyStatus.REVOKED, /ENTITLEMENT_KEY_REVOKED/],
		[EntitlementKeyStatus.EXPIRED, /ENTITLEMENT_KEY_EXPIRED/]
	])('refuses to consume a key in status %s', async (status, message) => {
		const fixture = keyFixture({ keys: [keyRow('k1', { status })] });

		await expect(fixture.service.consume(fixture.manager, fixture.store('k1') as never)).rejects.toThrow(message);
		expect(fixture.store('k1').status).toBe(status);
	});

	it('refuses to consume a key past its own expiry even while its status is ISSUED', async () => {
		const fixture = keyFixture({ keys: [keyRow('k1', { expiresAt: new Date(Date.now() - 1000) })] });

		await expect(fixture.service.consume(fixture.manager, fixture.store('k1') as never)).rejects.toThrow(
			/ENTITLEMENT_KEY_EXPIRED/
		);
	});
});

describe('EntitlementKeyService — revocation and replacement (doc 05 §19.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
	});

	afterEach(() => jest.restoreAllMocks());

	it('releases the activations the revoked key held and re-derives the right’s counters', async () => {
		const fixture = keyFixture({
			rights: [rightRow({ activationCount: 2 })],
			keys: [keyRow('k1')],
			activations: [
				activationRow('a1', { entitlementKeyId: 'k1' }),
				activationRow('a2', { entitlementKeyId: 'k1' }),
				// An activation that went through no key is not this key's to release.
				activationRow('a3', { entitlementKeyId: null })
			]
		});

		const revoked = await fixture.service.revoke('k1', 'KEY_SHARING');

		expect(revoked.status).toBe(EntitlementKeyStatus.REVOKED);
		expect(revoked.revokedByUserId).toBe('user-1');
		// The digest stays, because a revoked key is still the record that it was issued.
		expect(revoked.keyHash).toBe(digestLicenceKey('plaintext-k1'));
		expect(fixture.tables.entitlement_activation[0]).toMatchObject({
			status: EntitlementActivationStatus.REVOKED,
			revocationReason: 'KEY_SHARING'
		});
		expect(fixture.tables.entitlement_activation[1].status).toBe(EntitlementActivationStatus.REVOKED);
		expect(fixture.tables.entitlement_activation[2].status).toBe(EntitlementActivationStatus.ACTIVE);
		// The right keeps whatever it granted: the credential and the right are different things.
		expect(fixture.tables.entitlement[0]).toMatchObject({ status: EntitlementStatus.ACTIVE, activationCount: 1 });
	});

	it('writes one revocation event naming the activations it released', async () => {
		const fixture = keyFixture({ keys: [keyRow('k1')], activations: [activationRow('a1', { entitlementKeyId: 'k1' })] });

		await fixture.service.revoke('k1', 'FRAUD');

		expect(fixture.events()).toEqual(['entitlement_key.revoked']);
		expect(fixture.appended[0].data).toMatchObject({ keyId: 'k1', reason: 'FRAUD', activationIds: ['a1'] });
	});

	it('is idempotent: a replayed revocation neither changes the row nor emits a second event', async () => {
		const fixture = keyFixture({ keys: [keyRow('k1', { status: EntitlementKeyStatus.REVOKED })] });

		const revoked = await fixture.service.revoke('k1', 'FRAUD');

		expect(revoked.status).toBe(EntitlementKeyStatus.REVOKED);
		expect(fixture.appended).toEqual([]);
	});

	it('withdraws every credential of a right but leaves an already withdrawn one alone', async () => {
		const fixture = keyFixture({
			keys: [keyRow('k1'), keyRow('k2', { status: EntitlementKeyStatus.REVOKED }), keyRow('k3')]
		});

		const revoked = await fixture.service.revokeForEntitlement(fixture.manager, RIGHT, 'REFUNDED');

		expect(revoked).toEqual(['k1', 'k3']);
		expect(fixture.store('k1').status).toBe(EntitlementKeyStatus.REVOKED);
		expect(fixture.store('k3')).toMatchObject({ status: EntitlementKeyStatus.REVOKED, revokedByUserId: 'user-1' });
		expect(fixture.store('k1').metadata).toMatchObject({ revokedReason: 'REFUNDED' });
	});

	it('replaces a lost key with a fresh one and links the pair in both directions', async () => {
		const fixture = keyFixture({ keys: [keyRow('k1', { assignedToEmail: 'buyer@example.com' })] });

		const result = await fixture.service.reissue('k1', { reason: 'LOST' });

		expect(result.key.id).not.toBe('k1');
		expect(result.plaintext).toBeTruthy();
		expect(result.replacedKey).toMatchObject({ id: 'k1', status: EntitlementKeyStatus.REVOKED });
		// A reader never sees a key that points at a replacement which does not point back.
		expect(result.key.metadata).toMatchObject({ replacedKeyId: 'k1' });
		expect(result.replacedKey.metadata).toMatchObject({ replacedByKeyId: result.key.id, replacedReason: 'LOST' });
		// The replacement carries the holder and the term of the key it replaced.
		expect(result.key).toMatchObject({ assignedToEmail: 'buyer@example.com', entitlementId: RIGHT });
	});

	it('refuses to replace a key that was already withdrawn', async () => {
		// A withdrawn credential is never replaced: recovery from that state is a new key against the
		// right, which is a different act with a different audit trail.
		const fixture = keyFixture({ keys: [keyRow('k1', { status: EntitlementKeyStatus.REVOKED })] });

		await expect(fixture.service.reissue('k1', {})).rejects.toThrow(/ENTITLEMENT_KEY_REVOKED/);
		expect(fixture.tables.entitlement_key).toHaveLength(1);
	});

	it('lists the keys of a right newest first', async () => {
		const fixture = keyFixture({ keys: [keyRow('k1'), keyRow('k2')] });

		expect((await fixture.service.findForEntitlement(RIGHT)).map((key) => key.id)).toEqual(['k2', 'k1']);
	});
});

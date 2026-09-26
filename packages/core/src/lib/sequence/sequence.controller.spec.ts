/**
 * The numbering series over REST (API specification §7.3).
 *
 * The suite pins the four things a controller owes and a service cannot state for it:
 *
 * - **the guard chain** — both protocol guards are on the class, so a request that presents no
 *   credential is refused before a handler runs;
 * - **the permission of every route** — read on the metadata a guard actually reads, so the assertion
 *   is about the decision rather than about the decorator's prose. Every write carries
 *   `SEQUENCES_EDIT` and never the read permission, which is what makes "a caller who may look cannot
 *   change how this installation numbers its documents" true rather than intended;
 * - **the route decorators** — each route states the path it serves, and the edit route states the
 *   closed body that refuses a stated counter instead of stripping it;
 * - **the routes themselves** — each one is called and its delegation asserted, and a route whose
 *   service refuses surfaces a 4xx that is **not** a 404, which is the difference between "you may not
 *   do this" and "there is nothing here".
 *
 * The service is doubled, so the controller is the only thing under test: a route that stopped
 * delegating — or delegated somewhere else — fails here rather than being accommodated.
 */
jest.mock('../shared/guards', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {},
	// The gate on the GraphQL surface: the entity barrel this suite loads first reaches a module whose
	// resolver applies this third guard, and a decorator evaluated against an undefined token fails the
	// suite at load rather than at an assertion.
	FeatureFlagGuard: class FeatureFlagGuard {}
}));

jest.mock('./sequence.service', () => ({
	// The domain rules live in the service and are asserted by its own suites; this one is about the
	// routes. Doubling the module also keeps the service's graph — the ORM, the idempotency store, the
	// entity barrel — out of a suite that never reaches a database.
	SequenceService: class SequenceService {}
}));

/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `../channel/channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined
 * when the entity applies it if the graph is entered through the validators rather than the entities.
 */
import '../core/entities/internal';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { PermissionsEnum, SequenceResetPolicy } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { SequenceController } from './sequence.controller';
import type { SequenceService } from './sequence.service';

const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const CHANNEL = '00000000-0000-4000-8000-000000000010';
const SEQUENCE = '00000000-0000-4000-8000-000000000030';

/** The series a scripted service answers with. */
const STORED = {
	id: SEQUENCE,
	tenantId: '00000000-0000-4000-8000-000000000001',
	organizationId: ORGANIZATION,
	key: 'ORDER',
	channelId: CHANNEL,
	prefix: 'SO-',
	padding: 6,
	nextValue: 42,
	step: 1,
	resetPolicy: SequenceResetPolicy.MONTHLY,
	lastResetAt: new Date('2026-02-01T00:00:00.000Z'),
	isActive: true
};

/**
 * The controller over a scripted service, so every route's delegation is visible.
 */
function surfaces(overrides: Record<string, unknown> = {}) {
	const sequenceService = {
		listSeries: jest.fn().mockResolvedValue([STORED]),
		findSeriesOrFail: jest.fn().mockResolvedValue(STORED),
		createSeries: jest.fn().mockResolvedValue(STORED),
		updateSeries: jest.fn().mockResolvedValue(STORED),
		resetSeries: jest.fn().mockResolvedValue({ ...STORED, nextValue: 1 }),
		...overrides
	};

	return {
		sequenceService,
		controller: new SequenceController(sequenceService as unknown as SequenceService)
	};
}

/** Whether an HTTP failure is a refusal rather than a miss. */
function isRefusal(error: unknown): boolean {
	return error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() !== 404;
}

describe('SequenceController — the routes (API specification §7.3)', () => {
	it('lists the series of the caller’s organization, the bracketed filter included', async () => {
		const { controller, sequenceService } = surfaces();

		const answer = await controller.findAll({ filter: { key: 'ORDER', channelId: CHANNEL } });

		// The bracketed spelling the endpoint table names reaches the same narrowing the flat one does.
		expect(sequenceService.listSeries).toHaveBeenCalledWith({ key: 'ORDER', channelId: CHANNEL });
		expect(answer).toEqual({ items: [STORED], total: 1 });
	});

	it('accepts the flat spelling of the same filter', async () => {
		const { controller, sequenceService } = surfaces();

		await controller.findAll({ key: 'ORDER' });

		expect(sequenceService.listSeries).toHaveBeenCalledWith({ key: 'ORDER' });
	});

	it('leaves an absent member out of the narrowing rather than stating it as undefined', async () => {
		const { controller, sequenceService } = surfaces();

		await controller.findAll({});

		// A repository handed `{ key: undefined }` asks for the rows whose key *is* null, which is a
		// different question from "do not narrow on the key".
		expect(sequenceService.listSeries).toHaveBeenCalledWith({});
	});

	it('reads one series through the service method that scopes the read', async () => {
		const { controller, sequenceService } = surfaces();

		const series = await controller.findById(SEQUENCE);

		expect(sequenceService.findSeriesOrFail).toHaveBeenCalledWith(SEQUENCE);
		expect(series).toBe(STORED);
	});

	it('creates a series through the service that stamps the scope and the defaults', async () => {
		const { controller, sequenceService } = surfaces();

		const created = await controller.create({
			key: 'ORDER',
			channelId: CHANNEL,
			prefix: 'SO-',
			nextValue: 42
		} as never);

		expect(sequenceService.createSeries).toHaveBeenCalledWith({
			key: 'ORDER',
			channelId: CHANNEL,
			prefix: 'SO-',
			nextValue: 42
		});
		expect(created).toBe(STORED);
	});

	it('changes the configuration through the service that decides which members an edit writes', async () => {
		const { controller, sequenceService } = surfaces();

		await controller.update(SEQUENCE, { prefix: 'ORD-', resetPolicy: SequenceResetPolicy.YEARLY } as never);

		expect(sequenceService.updateSeries).toHaveBeenCalledWith(SEQUENCE, {
			prefix: 'ORD-',
			resetPolicy: SequenceResetPolicy.YEARLY
		});
	});

	it('restarts a series as a move of its own, with no payload', async () => {
		const { controller, sequenceService } = surfaces();

		const restarted = await controller.reset(SEQUENCE);

		// The route states the series and nothing else: the counter it is rewound to is the kernel's
		// decision, not the caller's, so there is no body for a caller to state one in.
		expect(sequenceService.resetSeries).toHaveBeenCalledWith(SEQUENCE);
		expect(restarted.nextValue).toBe(1);
	});
});

describe('SequenceController — refusals (a 4xx that is not a 404)', () => {
	it('refuses a key the organization already numbers with, naming the catalogue code', async () => {
		const refusal = new BadRequestException(
			"UNIQUE_CONSTRAINT_VIOLATION: a numbering series for 'ORDER' organization-wide already exists."
		);
		const { controller } = surfaces({ createSeries: jest.fn().mockRejectedValue(refusal) });

		const error = await controller.create({ key: 'ORDER' } as never).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('UNIQUE_CONSTRAINT_VIOLATION');
	});

	it('refuses an edit that states the counter, and the route is the closed body that reaches that refusal', async () => {
		const refusal = new BadRequestException(
			"PRECONDITION_REQUIRED: 'nextValue' is the series' state rather than its configuration, and an edit does not write it."
		);
		const { controller } = surfaces({ updateSeries: jest.fn().mockRejectedValue(refusal) });

		const error = await controller.update(SEQUENCE, { nextValue: 999 } as never).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('PRECONDITION_REQUIRED');
	});

	it('refuses a restart that is not due, and passes the kernel’s own reason through', async () => {
		const refusal = new BadRequestException(
			"PRECONDITION_REQUIRED: no restart is due for the series 'ORDER' — its reset policy is NEVER, so it never restarts."
		);
		const { controller } = surfaces({ resetSeries: jest.fn().mockRejectedValue(refusal) });

		const error = await controller.reset(SEQUENCE).catch((thrown) => thrown);

		expect(isRefusal(error)).toBe(true);
		expect((error as Error).message).toContain('reset policy is NEVER');
	});

	it('lets a miss stay a miss, so a caller can tell "not yours" from "no"', async () => {
		const { controller } = surfaces({
			findSeriesOrFail: jest
				.fn()
				.mockRejectedValue(new NotFoundException('RESOURCE_NOT_FOUND: no numbering series exists.'))
		});

		const error = await controller.findById(SEQUENCE).catch((thrown) => thrown);

		expect(error).toBeInstanceOf(NotFoundException);
		expect((error as HttpException).getStatus()).toBe(404);
		// A refusal and a miss are answered differently on purpose: "you may not" is not "there is
		// nothing here", and a client branches on the difference.
		expect(isRefusal(error)).toBe(false);
	});
});

describe('SequenceController — the guard stack and the permission every route declares', () => {
	it('guards the resource with both protocol guards', () => {
		const guards = Reflect.getMetadata('__guards__', SequenceController) ?? [];

		expect(guards).toEqual(expect.arrayContaining([TenantPermissionGuard, PermissionGuard]));
		// The class carries the read permission, which is what a caller who may only look is granted;
		// the writes each state the edit permission on their own handler.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, SequenceController)).toEqual([
			PermissionsEnum.SEQUENCES_VIEW
		]);
	});

	it('gives every route the permission the endpoint table names', () => {
		const proto = SequenceController.prototype;
		const expected: Array<[string, PermissionsEnum]> = [
			['findAll', PermissionsEnum.SEQUENCES_VIEW],
			['findById', PermissionsEnum.SEQUENCES_VIEW],
			['create', PermissionsEnum.SEQUENCES_EDIT],
			['update', PermissionsEnum.SEQUENCES_EDIT],
			['reset', PermissionsEnum.SEQUENCES_EDIT]
		];

		for (const [route, permission] of expected) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, proto[route])).toEqual([permission]);
		}
	});

	it('refuses every write to a caller who holds only the read permission', () => {
		const proto = SequenceController.prototype;

		for (const route of ['create', 'update', 'reset']) {
			const stated = Reflect.getMetadata(PERMISSIONS_METADATA, proto[route]) ?? [];

			expect(stated).not.toContain(PermissionsEnum.SEQUENCES_VIEW);
			expect(stated).toEqual([PermissionsEnum.SEQUENCES_EDIT]);
		}
	});

	it('offers no removal route, which is the one operation this resource must not serve', () => {
		const proto = SequenceController.prototype as unknown as Record<string, unknown>;

		// A series *is* its counter: removing the row answers every later allocation for its key "no
		// series is configured", and creating it again counts from one and reissues numbers the removed
		// row had already issued. Retirement is `isActive: false` through the edit.
		for (const absent of ['delete', 'softRemove', 'softRecover', 'getCount', 'pagination']) {
			expect(proto[absent]).toBeUndefined();
		}
	});

	it('states the path of every route it serves', () => {
		const source = readFileSync(join(__dirname, 'sequence.controller.ts'), 'utf8');

		expect(source).toMatch(/@Get\('\/'\)\n\t@UseValidationPipe\(\{ transform: true, whitelist: true \}\)\n\tasync findAll\(/);
		expect(source).toMatch(/@Get\('\/:id'\)/);
		expect(source).toMatch(/@Post\('\/'\)\n\t@UseValidationPipe\(\{ transform: true, whitelist: true \}\)\n\tasync create\(/);
		expect(source).toMatch(/@Put\('\/:id'\)/);
		expect(source).toMatch(/@Post\('\/:id\/reset'\)/);
	});

	it('binds the edit body to the closed DTO, so a stated counter is refused rather than stripped', () => {
		const source = readFileSync(join(__dirname, 'sequence.controller.ts'), 'utf8');

		// A pipe that only whitelists drops an unknown member silently, and a caller that believed it set
		// `nextValue` is answered `200` for a write that changed nothing it asked for. The route
		// therefore refuses the unknown member — the same convention the credential route uses for a
		// plaintext password.
		expect(source).toMatch(
			/@UseValidationPipe\(\{ transform: true, whitelist: true, forbidNonWhitelisted: true \}\)\n\tasync update\(/
		);
		expect(source).not.toMatch(/forbidNonWhitelisted: true \}\)\n\tasync create\(/);
	});
});

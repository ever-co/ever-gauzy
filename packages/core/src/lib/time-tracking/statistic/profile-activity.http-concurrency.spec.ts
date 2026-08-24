jest.mock('dotenv', () => ({
	config: jest.fn(() => ({ parsed: {} }))
}));

import * as dotenv from 'dotenv';
import '../../core/entities/internal';

import { spawn } from 'node:child_process';
import { AddressInfo } from 'node:net';
import { isAbsolute, resolve } from 'node:path';
import { CanActivate, Controller, ExecutionContext, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DatabaseTypeEnum } from '@gauzy/config';
import { ID, IGetProfileActivity, IProfileActivity } from '@gauzy/contracts';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { MultiORMEnum } from '../../core/utils';
import { TenantPermissionGuard } from '../../shared/guards';
import { ProfileActivityController } from './profile-activity.controller';
import { ProfileActivityQueryDTO } from './dto/profile-activity-query.dto';
import { StatisticService } from './statistic.service';

const TENANT_ID = '8a190e8c-3c48-4b88-a895-8a8b1554a120';
const ORGANIZATION_ID = '7a9c473a-7888-4456-9854-7c78c15ac751';
const EMPLOYEE_ID = 'c05ef9ed-cb2f-4024-9e8d-aa04292dc3b7';
const OTHER_EMPLOYEE_ID = '407507e5-2302-48eb-9630-c5679542d47d';
const TEAM_ID = '9431dff6-fee4-450f-af22-a7d61b7744ae';
const BEARER_TOKEN = 'profile-http-concurrency-token';
const PROFILE_PATHNAME = '/api/timesheet/statistics/profile-activity';
const MAX_CAPTURE_BYTES = 64 * 1024;
const CHILD_DEADLINE_MILLISECONDS = 20_000;
const CHILD_KILL_DEADLINE_MILLISECONDS = 5000;

const request: IGetProfileActivity = {
	organizationId: ORGANIZATION_ID,
	employeeId: EMPLOYEE_ID,
	organizationTeamId: TEAM_ID,
	startDate: '2026-08-01',
	endDate: '2026-08-04',
	timeZone: 'UTC',
	includeDaily: true
};

const expectedResponse: IProfileActivity = {
	employeeId: EMPLOYEE_ID,
	activeDays: 2,
	totalDuration: 75,
	firstActiveOn: '2026-08-01',
	lastActiveOn: '2026-08-02',
	period: {
		startDate: '2026-08-01',
		endDate: '2026-08-04',
		timeZone: 'UTC'
	},
	daily: [
		{ date: '2026-08-01', duration: 45 },
		{ date: '2026-08-02', duration: 30 }
	]
};

type FixtureTimeLog = {
	id: string;
	tenantId: string;
	organizationId: string;
	employeeId: string;
	startedAt: Date;
	stoppedAt: Date | null;
	deletedAt: Date | null;
};

type VerifierMetrics = {
	ok: boolean;
	profile: { count: number; minMilliseconds: number; p95Milliseconds: number; maxMilliseconds: number };
	liveness: { count: number; minMilliseconds: number; p95Milliseconds: number; maxMilliseconds: number };
	thresholdsMilliseconds: {
		profileP95Milliseconds: number;
		livenessP95Milliseconds: number;
		livenessMaxMilliseconds: number;
	};
	caveat: string;
};

type ChildResult = {
	code: number | null;
	signal: NodeJS.Signals | null;
	stdout: string;
	stderr: string;
	stdoutOverflow: boolean;
	stderrOverflow: boolean;
	timedOut: boolean;
};

const TimeLogSchema = new EntitySchema<FixtureTimeLog>({
	name: 'ProfileActivityHttpConcurrencyTimeLog',
	tableName: 'time_log',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		employeeId: { type: 'varchar' },
		startedAt: { type: Date },
		stoppedAt: { type: Date, nullable: true },
		deletedAt: { type: Date, nullable: true, deleteDate: true }
	}
});

class HttpConcurrencyStatisticService extends StatisticService {
	constructor(repository: Repository<FixtureTimeLog>) {
		super(
			{ createQueryBuilder: jest.fn() } as any,
			{ existsBy: jest.fn() } as any,
			{ createQueryBuilder: jest.fn() } as any,
			repository as any,
			{} as any,
			{} as any,
			{ dbConnectionOptions: { type: DatabaseTypeEnum.betterSqlite3 } } as any,
			{} as any
		);
		this.ormType = MultiORMEnum.TypeORM;
	}

	protected assertProfileActivityAccess(): Promise<ID> {
		return Promise.resolve(TENANT_ID);
	}
}

@Controller('health')
class TestLivenessController {
	@Get('live')
	live(): { status: 'ok' } {
		return { status: 'ok' };
	}
}

function at(value: string): Date {
	return new Date(value);
}

function createFixtureRows(): FixtureTimeLog[] {
	return [
		{
			id: 'http-matching-first',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			startedAt: at('2026-08-01T08:00:00.000Z'),
			stoppedAt: at('2026-08-01T08:00:45.000Z'),
			deletedAt: null
		},
		{
			id: 'http-matching-second',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			startedAt: at('2026-08-02T09:00:00.000Z'),
			stoppedAt: at('2026-08-02T09:00:30.000Z'),
			deletedAt: null
		},
		{
			id: 'http-deleted-distractor',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			startedAt: at('2026-08-02T10:00:00.000Z'),
			stoppedAt: at('2026-08-02T10:10:00.000Z'),
			deletedAt: at('2026-08-02T11:00:00.000Z')
		},
		{
			id: 'http-employee-distractor',
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: OTHER_EMPLOYEE_ID,
			startedAt: at('2026-08-02T12:00:00.000Z'),
			stoppedAt: at('2026-08-02T12:10:00.000Z'),
			deletedAt: null
		}
	];
}

function profileQueryPath(): string {
	const query = new URLSearchParams({
		organizationId: ORGANIZATION_ID,
		employeeId: EMPLOYEE_ID,
		organizationTeamId: TEAM_ID,
		startDate: request.startDate,
		endDate: request.endDate,
		timeZone: request.timeZone,
		includeDaily: 'true'
	});

	return `${PROFILE_PATHNAME}?${query.toString()}`;
}

function minimalChildEnvironment(baseUrl: string): NodeJS.ProcessEnv {
	const environment: NodeJS.ProcessEnv = {};
	for (const name of ['SystemRoot', 'WINDIR', 'ComSpec', 'TEMP', 'TMP']) {
		const value = process.env[name];
		if (value) environment[name] = value;
	}

	environment.PROFILE_ACTIVITY_BASE_URL = baseUrl;
	environment.PROFILE_ACTIVITY_BEARER_TOKEN = BEARER_TOKEN;
	environment.PROFILE_ACTIVITY_TENANT_ID = TENANT_ID;
	environment.PROFILE_ACTIVITY_QUERY_PATH = profileQueryPath();

	return environment;
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

function captureStream(
	stream: NodeJS.ReadableStream,
	onOverflow: () => void
): {
	chunks: Buffer[];
	overflowed: () => boolean;
} {
	const chunks: Buffer[] = [];
	let bytes = 0;
	let overflow = false;

	stream.on('data', (chunk: Buffer | string) => {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		const remaining = MAX_CAPTURE_BYTES - bytes;
		if (remaining > 0) {
			const captured = buffer.length <= remaining ? buffer : buffer.subarray(0, remaining);
			chunks.push(captured);
			bytes += captured.length;
		}
		if (buffer.length > remaining && !overflow) {
			overflow = true;
			onOverflow();
		}
	});

	return { chunks, overflowed: () => overflow };
}

async function waitForVerifier(child: ReturnType<typeof spawn>): Promise<ChildResult> {
	let timedOut = false;
	const stdoutCapture = captureStream(child.stdout, () => child.kill());
	const stderrCapture = captureStream(child.stderr, () => child.kill());
	const closePromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolveClose, reject) => {
		child.once('error', reject);
		child.once('close', (code, signal) => resolveClose({ code, signal }));
	});
	const deadline = wait(CHILD_DEADLINE_MILLISECONDS).then(() => null);
	let close = await Promise.race([closePromise, deadline]);

	if (close === null) {
		timedOut = true;
		child.kill();
		close = await Promise.race([closePromise, wait(CHILD_KILL_DEADLINE_MILLISECONDS).then(() => null)]);
		if (close === null) throw new Error('Verifier child did not close after termination');
	}

	return {
		...close,
		stdout: Buffer.concat(stdoutCapture.chunks).toString('utf8'),
		stderr: Buffer.concat(stderrCapture.chunks).toString('utf8'),
		stdoutOverflow: stdoutCapture.overflowed(),
		stderrOverflow: stderrCapture.overflowed(),
		timedOut
	};
}

async function terminateAndWait(child: ReturnType<typeof spawn> | undefined): Promise<void> {
	if (!child || child.exitCode !== null || child.signalCode !== null) return;

	const closed = new Promise<void>((resolveClose) => child.once('close', () => resolveClose()));
	child.kill();
	await Promise.race([closed, wait(CHILD_KILL_DEADLINE_MILLISECONDS)]);
}

jest.setTimeout(90_000);

describe('profile activity loopback HTTP concurrency evidence', () => {
	it('keeps profile and public liveness responsive through the redacting external verifier', async () => {
		expect(jest.isMockFunction(dotenv.config)).toBe(true);
		expect(dotenv.config).toHaveBeenCalled();

		const capturedQueries: string[] = [];
		let capture = false;
		let guardCalls = 0;
		let app: INestApplication | undefined;
		let child: ReturnType<typeof spawn> | undefined;
		const dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TimeLogSchema],
			synchronize: true,
			logging: ['query'],
			logger: {
				logQuery: (sql: string) => {
					if (capture) capturedQueries.push(sql);
				},
				logQueryError: () => undefined,
				logQuerySlow: () => undefined,
				logSchemaBuild: () => undefined,
				logMigration: () => undefined,
				log: () => undefined
			} as any
		});

		try {
			await dataSource.initialize();
			const repository = dataSource.getRepository(TimeLogSchema);
			await repository.insert(createFixtureRows());
			const service = new HttpConcurrencyStatisticService(repository);
			await expect(service.getProfileActivity(request)).resolves.toEqual(expectedResponse);
			const getProfileActivity = jest.spyOn(service, 'getProfileActivity');

			const strictGuard: CanActivate = {
				canActivate(context: ExecutionContext): boolean {
					guardCalls += 1;
					const incoming = context.switchToHttp().getRequest<{
						headers: Record<string, string | string[] | undefined>;
					}>();
					return (
						incoming.headers.authorization === `Bearer ${BEARER_TOKEN}` &&
						incoming.headers['tenant-id'] === TENANT_ID
					);
				}
			};
			const module = await Test.createTestingModule({
				controllers: [ProfileActivityController, TestLivenessController],
				providers: [{ provide: StatisticService, useValue: service }]
			})
				.overrideGuard(TenantPermissionGuard)
				.useValue(strictGuard)
				.compile();

			app = module.createNestApplication();
			app.setGlobalPrefix('api');
			await app.listen(0, '127.0.0.1');
			const address = app.getHttpServer().address() as AddressInfo;
			expect(address.address).toBe('127.0.0.1');
			const baseUrl = `http://127.0.0.1:${address.port}`;
			const verifierPath = resolve(process.cwd(), 'scripts', 'verify-profile-activity-concurrency.mjs');
			expect(isAbsolute(verifierPath)).toBe(true);

			const childEnvironment = minimalChildEnvironment(baseUrl);
			expect(childEnvironment.NODE_OPTIONS).toBeUndefined();
			expect(
				Object.keys(childEnvironment)
					.filter((name) => name.startsWith('PROFILE_ACTIVITY_'))
					.sort()
			).toEqual(
				[
					'PROFILE_ACTIVITY_BASE_URL',
					'PROFILE_ACTIVITY_BEARER_TOKEN',
					'PROFILE_ACTIVITY_QUERY_PATH',
					'PROFILE_ACTIVITY_TENANT_ID'
				].sort()
			);

			capture = true;
			child = spawn(process.execPath, [verifierPath], {
				cwd: process.cwd(),
				env: childEnvironment,
				stdio: ['ignore', 'pipe', 'pipe'],
				windowsHide: true
			});
			const result = await waitForVerifier(child);
			capture = false;

			expect(result.timedOut).toBe(false);
			expect(result.stdoutOverflow).toBe(false);
			expect(result.stderrOverflow).toBe(false);
			expect(result.signal).toBeNull();
			expect(result.code).toBe(0);
			expect(result.stderr).toBe('');
			const lines = result.stdout.trim().split(/\r?\n/u);
			expect(lines).toHaveLength(1);
			const metrics = JSON.parse(lines[0]) as VerifierMetrics;

			expect(metrics.ok).toBe(true);
			expect(metrics.profile.count).toBe(32);
			expect(metrics.liveness.count).toBe(32);
			expect(metrics.thresholdsMilliseconds).toEqual({
				profileP95Milliseconds: 750,
				livenessP95Milliseconds: 250,
				livenessMaxMilliseconds: 500
			});
			expect(metrics.profile.p95Milliseconds).toBeLessThanOrEqual(750);
			expect(metrics.liveness.p95Milliseconds).toBeLessThanOrEqual(250);
			expect(metrics.liveness.maxMilliseconds).toBeLessThanOrEqual(500);
			expect(metrics.caveat).toMatch(/^HTTP latency only;/u);

			expect(guardCalls).toBe(32);
			expect(getProfileActivity).toHaveBeenCalledTimes(32);
			for (const [dto] of getProfileActivity.mock.calls) {
				expect(dto).toBeInstanceOf(ProfileActivityQueryDTO);
				expect(dto).toEqual(request);
				expect(dto.includeDaily).toBe(true);
				expect(typeof dto.includeDaily).toBe('boolean');
			}
			const selects = capturedQueries.filter((sql) => /^\s*SELECT\b/i.test(sql));
			expect(selects).toHaveLength(32);
			expect(selects.every((sql) => !/\bJOIN\b/i.test(sql))).toBe(true);
			console.info(`PROFILE_ACTIVITY_HTTP_METRICS ${JSON.stringify(metrics)}`);
		} finally {
			capture = false;
			await terminateAndWait(child);
			if (app) await app.close();
			if (dataSource.isInitialized) await dataSource.destroy();
		}
	});
});

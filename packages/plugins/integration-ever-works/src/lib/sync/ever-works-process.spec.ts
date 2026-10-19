/**
 * The sync's Gauzy writes in any process (follow-up of G-P1-9): the tenant-scoped request context each
 * write opens, the context store attached where a process has none (the worker builds its module graph
 * without core's `AppModule`), a missing platform write path turned into a deferral, and the sync loop
 * staying out of a process that does not host the platform's write services.
 *
 * `RequestContext` is a stand-in with the platform's semantics (`request-context.ts`): no store attached →
 * `runWithRequest` runs the work with no context; attached → a fresh nestjs-cls store per run holding the
 * request, from which every accessor reads. nestjs-cls itself is the real package.
 *
 * The tests of one file share the module's "store confirmed" state, so they run in this order: the
 * refusals first, then the attach.
 */
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	type Store = { run: (options: unknown, fn: () => unknown) => unknown; get: (key: string) => unknown; set: (key: string, value: unknown) => void };
	type Req = { user?: { id?: string; tenantId?: string; lastOrganizationId?: string } };
	class RequestContext {
		static clsService: Store | undefined;
		static setClsService(service: Store): void {
			RequestContext.clsService = service;
		}
		static runWithRequest<T>(req: Req, callback: () => T, options: { id?: string } = {}): T {
			const cls = RequestContext.clsService;
			if (!cls) return callback();
			return cls.run({ ifNested: 'override' }, () => {
				cls.set('RequestContext', { id: options.id, _req: req });
				return callback();
			}) as T;
		}
		static currentRequestContext(): { id?: string; _req: Req } | undefined {
			return RequestContext.clsService?.get('RequestContext') as { id?: string; _req: Req } | undefined;
		}
		static currentTenantId(): string | null {
			return RequestContext.currentRequestContext()?._req?.user?.tenantId || null;
		}
		static currentUserId(): string | null {
			return RequestContext.currentRequestContext()?._req?.user?.id || null;
		}
		static currentOrganizationId(): string | null {
			return RequestContext.currentRequestContext()?._req?.user?.lastOrganizationId || null;
		}
	}
	return {
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMManyToOne: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		TenantBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		...Object.fromEntries(
			['Tenant', 'Employee', 'EmployeeNotification', 'IntegrationTenant', 'IntegrationSetting', 'UserOrganization'].map((name) => [name, { [name]: class {} }[name]])
		),
		createSsrfSafeHttpsAgent: () => undefined,
		TaskService: class TaskService {},
		OrganizationProjectService: class OrganizationProjectService {},
		EmployeeService: class EmployeeService {},
		RequestContext
	};
});
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));

import 'reflect-metadata';
import { CommandHandlerNotFoundException } from '@nestjs/cqrs';
import { ClsServiceManager } from 'nestjs-cls';
import { EmployeeService, OrganizationProjectService, RequestContext, TaskService } from '@gauzy/core';
import { EverWorksNoRequestContextError, runAsGauzyUser } from './ever-works-actor';
import { ensureRequestContextStore, EverWorksProcessCapability, isMissingWritePath, runInSyncRequestContext, syncRequestUser } from './ever-works-process';
import { EverWorksSyncLoop } from './ever-works-sync.loop';

const scope = { tenantId: 'tenant-1', organizationId: 'org-1' } as never as { tenantId: string; organizationId: string };
const unavailable = () => new Error('unavailable');

describe('the sync writes in any process', () => {
	afterEach(() => jest.restoreAllMocks());

	it('refuses before anything runs where no context store can be attached', async () => {
		jest.spyOn(ClsServiceManager, 'getClsService').mockReturnValue(undefined as never);
		expect(ensureRequestContextStore()).toBe(false);
		const work = jest.fn(async () => 'written');
		await expect(runInSyncRequestContext(syncRequestUser(scope as never, 'user-1' as never), work, unavailable)).rejects.toThrow('unavailable');
		expect(work).not.toHaveBeenCalled();
		// The record handlers see the error they defer on.
		await expect(runAsGauzyUser({ ...scope, connection: {} } as never, 'user-1' as never, work)).rejects.toBeInstanceOf(EverWorksNoRequestContextError);
		expect(work).not.toHaveBeenCalled();
	});

	it('attaches the process-wide store where none is attached (the worker), so each write opens its own tenant-scoped context', async () => {
		expect((RequestContext as unknown as { clsService?: unknown }).clsService).toBeUndefined();
		expect(ensureRequestContextStore()).toBe(true);
		// The very instance core's AppModule attaches in the API (nestjs-cls keeps one per process).
		expect((RequestContext as unknown as { clsService?: unknown }).clsService).toBe(ClsServiceManager.getClsService());

		const seen = await runInSyncRequestContext(
			syncRequestUser(scope as never, 'user-1' as never, 'Ada'),
			async () => ({
				tenantId: RequestContext.currentTenantId(),
				userId: RequestContext.currentUserId(),
				organizationId: RequestContext.currentOrganizationId()
			}),
			unavailable
		);
		expect(seen).toEqual({ tenantId: 'tenant-1', userId: 'user-1', organizationId: 'org-1' });
		// Outside a run nothing changed: no tenant, no user (code that never enters one is unaffected).
		expect(RequestContext.currentTenantId()).toBeNull();
		expect(RequestContext.currentUserId()).toBeNull();
	});

	it('signs the write in with no employee and no permission', () => {
		expect(syncRequestUser(scope as never, null)).toEqual({
			id: undefined,
			tenantId: 'tenant-1',
			lastOrganizationId: 'org-1',
			name: 'Ever Works',
			firstName: 'Ever Works',
			lastName: '',
			employeeId: undefined,
			permissions: []
		});
	});

	it('opens a fresh context: an enclosing request is not visible inside and is back afterwards', async () => {
		const outer = syncRequestUser({ tenantId: 'tenant-outer', organizationId: 'org-outer' } as never, 'outer-user' as never);
		await runInSyncRequestContext(
			outer,
			async () => {
				const inner = await runInSyncRequestContext(syncRequestUser(scope as never, null), async () => [RequestContext.currentTenantId(), RequestContext.currentUserId()], unavailable);
				expect(inner).toEqual(['tenant-1', null]);
				expect(RequestContext.currentTenantId()).toBe('tenant-outer');
			},
			unavailable
		);
	});

	it('a platform write path this process does not host defers the write; other failures stay failures', async () => {
		await expect(
			runInSyncRequestContext(syncRequestUser(scope as never, null), async () => {
				throw new CommandHandlerNotFoundException('TaskCreateCommand');
			}, unavailable)
		).rejects.toThrow('unavailable');
		class UnknownElementException extends Error {}
		expect(isMissingWritePath(new UnknownElementException('TaskService'))).toBe(true);
		await expect(
			runInSyncRequestContext(syncRequestUser(scope as never, null), async () => {
				throw new Error('constraint violated');
			}, unavailable)
		).rejects.toThrow('constraint violated');
		expect(isMissingWritePath(new Error('boom'))).toBe(false);
	});

	it('tells whether this process hosts the task, project and employee services the writes go through', () => {
		const hosted = new Set<unknown>([TaskService, OrganizationProjectService, EmployeeService]);
		const moduleRef = {
			get: (type: unknown) => {
				if (!hosted.has(type)) throw new Error('Nest could not find the element');
				return {};
			}
		};
		expect(new EverWorksProcessCapability(moduleRef as never).canWriteGauzy()).toBe(true);
		hosted.delete(TaskService);
		hosted.delete(EmployeeService);
		const worker = new EverWorksProcessCapability(moduleRef as never);
		expect(worker.canWriteGauzy()).toBe(false);
		expect(worker.missingWriteServices()).toEqual(['TaskService', 'EmployeeService']);
	});

	describe('the sync loop', () => {
		const capability = (missing: string[]) => ({ missingWriteServices: () => missing }) as unknown as EverWorksProcessCapability;
		const loop = (env: Record<string, string | undefined>, missing: string[] | null) =>
			new EverWorksSyncLoop({} as never, {} as never, {} as never, {} as never, {} as never, env, missing ? capability(missing) : undefined);

		it('runs in a process that hosts the write services (the API)', () => {
			expect(loop({ EVER_WORKS_ENABLED: 'true' }, []).start()).toBe(true);
			expect(loop({ EVER_WORKS_ENABLED: 'true' }, null).start()).toBe(true);
		});

		it('stays out of a process that does not host them (the worker), so the lease never strands the writes', () => {
			const worker = loop({ EVER_WORKS_ENABLED: 'true' }, ['TaskService', 'OrganizationProjectService', 'EmployeeService']);
			const warn = jest.spyOn((worker as unknown as { logger: { warn: (message: string) => void } }).logger, 'warn').mockImplementation(() => undefined);
			expect(worker.start()).toBe(false);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0]?.[0]).toContain('TaskService, OrganizationProjectService, EmployeeService');
		});

		it('keeps the switches: plugin off, or EVER_WORKS_SYNC_LOOP=off', () => {
			expect(loop({}, []).start()).toBe(false);
			expect(loop({ EVER_WORKS_ENABLED: 'true', EVER_WORKS_SYNC_LOOP: 'off' }, []).start()).toBe(false);
		});
	});
});

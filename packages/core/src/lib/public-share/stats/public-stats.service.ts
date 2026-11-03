import { Injectable, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { MoreThan } from 'typeorm';
import { EmployeeKindEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { MultiORMEnum, getORMType } from '../../core/utils';
import { EmployeeService } from '../../employee/employee.service';
import { OrganizationProjectService } from '../../organization-project/organization-project.service';
import { OrganizationTeamService } from '../../organization-team/organization-team.service';
import { TenantService } from '../../tenant/tenant.service';
import { ScreenshotService } from '../../time-tracking/screenshot/screenshot.service';
import { MikroOrmTimeSlotRepository } from '../../time-tracking/time-slot/repository/mikro-orm-time-slot.repository';
import { TypeOrmTimeSlotRepository } from '../../time-tracking/time-slot/repository/type-orm-time-slot.repository';
import { UserService } from '../../user/user.service';
import { PublicStats } from './public-stats.types';

/** How long (ms) the public counts are reused when `PUBLIC_STATS_TTL_MS` is not set: one hour. */
export const DEFAULT_PUBLIC_STATS_TTL_MS = 60 * 60 * 1000;

/** The window of the "tenants registered recently" count, in days. */
export const PUBLIC_STATS_NEW_TENANT_WINDOW_DAYS = 90;

/**
 * The reuse window of the public counts, from `PUBLIC_STATS_TTL_MS`: milliseconds, `0` / `false` / `off` to
 * count on every call, anything unreadable the default (one hour).
 *
 * @param value The setting's raw value (the environment variable by default).
 * @returns The window in milliseconds; `0` disables the reuse.
 */
export function resolvePublicStatsTtlMs(value: string | undefined = process.env.PUBLIC_STATS_TTL_MS): number {
	if (value === undefined || value === null || value.trim() === '') {
		return DEFAULT_PUBLIC_STATS_TTL_MS;
	}
	const normalized = value.trim().toLowerCase();
	if (normalized === 'false' || normalized === 'off' || normalized === 'no') {
		return 0;
	}
	const parsed = Number(normalized);
	if (!Number.isFinite(parsed) || parsed < 0) {
		return DEFAULT_PUBLIC_STATS_TTL_MS;
	}
	return Math.floor(parsed);
}

/**
 * The `Cache-Control` the route answers for a given window: clients and CDNs may reuse the figures for the
 * service's own window, with a short grace in which a stale copy may be served while the next one is fetched;
 * `no-store` when the window is `0`, since then every call is meant to recount.
 *
 * @param ttlMs The reuse window in milliseconds (see {@link resolvePublicStatsTtlMs}).
 * @returns The header value.
 */
export function publicStatsCacheControl(ttlMs: number): string {
	if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
		return 'no-store';
	}
	const maxAge = Math.floor(ttlMs / 1000);
	return `public, max-age=${maxAge}, stale-while-revalidate=${Math.min(600, maxAge)}`;
}

/**
 * The counts behind `GET /public/stats`: the installation's tenants, people, teams, projects, screenshots and
 * tracked hours, as whole numbers and nothing else (see {@link PublicStats}).
 *
 * The route is public and the statements run over the whole database (the screenshot table alone holds
 * millions of rows on a busy installation), so one computation per window (`PUBLIC_STATS_TTL_MS`, one hour
 * by default) serves every caller, concurrent callers share the computation in flight, and once the window
 * has passed the previous figures are answered at once while the recount runs behind the request: the
 * counts move slowly, and no visitor waits on a table scan.
 */
@Injectable()
export class PublicStatsService {
	private readonly logger = new Logger(PublicStatsService.name);

	private readonly ttlMs = resolvePublicStatsTtlMs();
	private cached?: { stats: PublicStats; expiresAt: number };
	private computing?: Promise<PublicStats>;

	constructor(
		readonly _tenantService: TenantService,
		readonly _userService: UserService,
		readonly _employeeService: EmployeeService,
		readonly _organizationTeamService: OrganizationTeamService,
		readonly _organizationProjectService: OrganizationProjectService,
		readonly _screenshotService: ScreenshotService,
		readonly _typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		readonly _mikroOrmTimeSlotRepository: MikroOrmTimeSlotRepository
	) {}

	/** The `Cache-Control` matching this service's window (see {@link publicStatsCacheControl}). */
	get cacheControl(): string {
		return publicStatsCacheControl(this.ttlMs);
	}

	/**
	 * The public counts, from the window's cache when it holds them (the class note has the reuse rules).
	 *
	 * @returns The counts.
	 */
	async getPublicStats(): Promise<PublicStats> {
		// A request carrying a user narrows the tenant-aware counts to its tenant: such figures are that
		// caller's own and are never cached, so they are never shared with anyone else.
		if (this.ttlMs <= 0 || RequestContext.currentUser()) {
			return this.computePublicStats();
		}
		if (this.cached && this.cached.expiresAt > Date.now()) {
			return this.cached.stats;
		}
		const fresh = this.refresh();
		if (this.cached) {
			// The window has passed: answer the previous figures now and let the recount replace them when it
			// lands. A failed recount is logged by `computePublicStats` and leaves the previous figures in
			// place; the next call tries again.
			fresh.catch(() => undefined);
			return this.cached.stats;
		}
		return fresh;
	}

	/**
	 * One recount at a time: a second caller joins the computation in flight instead of starting another.
	 *
	 * @returns The counts, once computed and stored for the window.
	 */
	private refresh(): Promise<PublicStats> {
		if (!this.computing) {
			this.computing = this.computePublicStats()
				.then((stats) => {
					this.cached = { stats, expiresAt: Date.now() + this.ttlMs };
					return stats;
				})
				.finally(() => {
					this.computing = undefined;
				});
		}
		return this.computing;
	}

	/**
	 * Computes the counts from the database.
	 *
	 * @returns The counts.
	 */
	private async computePublicStats(): Promise<PublicStats> {
		try {
			// `Date.now()` rather than a bare `new Date()`, so a test can pin the clock.
			const computedAt = new Date(Date.now());
			const since = new Date(computedAt.getTime() - PUBLIC_STATS_NEW_TENANT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

			const [
				tenants,
				tenantsLast90Days,
				users,
				agentUsers,
				employees,
				teams,
				projects,
				screenshots,
				hoursTracked
			] = await Promise.all([
				this._tenantService.count(),
				this._tenantService.count({ where: { createdAt: MoreThan(since) } }),
				this._userService.count(),
				this._userService.countAgentUsers(),
				// People, not agent employees (the count `GET /stats/global` publishes too)
				this._employeeService.count({ where: { kind: EmployeeKindEnum.HUMAN } }),
				this._organizationTeamService.count(),
				this._organizationProjectService.count(),
				this._screenshotService.count(),
				this.getTrackedHours()
			]);

			return {
				tenants,
				tenantsLast90Days,
				users: Math.max(0, users - agentUsers),
				employees,
				teams,
				projects,
				screenshots,
				hoursTracked,
				computedAt: computedAt.toISOString()
			};
		} catch (error) {
			this.logger.error(`Error computing the public statistics: ${error?.message ?? error}`, error?.stack);
			throw new Error(`Failed to retrieve the public statistics: ${error?.message ?? error}`);
		}
	}

	/**
	 * The sum of every time slot's duration, in whole hours rounded down. Time slots rather than time logs:
	 * a slot's duration is the window the tracker measured, while a log's start and stop are what the
	 * tracker reported and are wrong on some old rows (`GET /stats/global` sums the logs and clamps them).
	 * Deleted slots are left out.
	 *
	 * @returns The hours; `0` when nothing was tracked or the sum is unreadable.
	 */
	private async getTrackedHours(): Promise<number> {
		let seconds = 0;
		switch (getORMType()) {
			case MultiORMEnum.MikroORM: {
				// Raw knex skips MikroORM's soft-delete filter, so deleted slots are excluded here.
				const knex = this._mikroOrmTimeSlotRepository.getKnex() as unknown as Knex;
				const row = await knex('time_slot').sum({ total: 'duration' }).whereNull('deletedAt').first();
				seconds = Number(row?.total ?? 0);
				break;
			}
			case MultiORMEnum.TypeORM:
			default: {
				// The query builder leaves soft-deleted slots out on its own.
				const row = await this._typeOrmTimeSlotRepository
					.createQueryBuilder('time_slot')
					.select('COALESCE(SUM(time_slot.duration), 0)', 'total')
					.getRawOne<{ total: string | number }>();
				seconds = Number(row?.total ?? 0);
				break;
			}
		}
		if (!Number.isFinite(seconds) || seconds <= 0) {
			return 0;
		}
		return Math.floor(seconds / 3600);
	}
}

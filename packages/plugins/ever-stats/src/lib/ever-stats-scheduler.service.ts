import { Inject, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
	EverInstanceIdentityChangedError,
	EverInstanceKeyError,
	EverInstanceRecord,
	EverInstanceService,
	EverStatsSigner
} from '@gauzy/plugin-ever-instance';
import { STATS_LEASE_MS, STATS_REFUSAL_PARK_MS, STATS_REPORTS_KEPT, STATS_RETRY_DELAYS_S, MODULE_VERSION } from './ever-stats.constants';
import type { EverStatsConfig } from './ever-stats-config';
import { isEverStatsEnabled } from './ever-stats-enabled';
import { EverStatsBuilder, parseReleaseVersion } from './ever-stats-builder.service';
import { EverStatsCollector, StatsCollectionTimeout, statsPeriod, StatsPeriod } from './ever-stats-collector.service';
import { EverStatsSender, StatsSendOutcome } from './ever-stats-sender.service';
import { EverStatsStore, StatsReportStatus, StoredStatsReport } from './ever-stats.store';

/** Injection token: the settings read at boot. */
export const EVER_STATS_CONFIG = 'EVER_STATS_CONFIG';

/**
 * Injection token: the environment the module re-reads at run time (default `process.env`), so
 * `EVER_STATS_ENABLED=false` switches it off even when it was loaded before that value was read.
 */
export const EVER_STATS_ENV = 'EVER_STATS_ENV';

/** Injection token: the clock and the random source (tests pass their own). */
export const EVER_STATS_CLOCK = 'EVER_STATS_CLOCK';
export interface StatsClock {
	now(): number;
	/** Uniform in [0, 1). */
	random(): number;
}
const SYSTEM_CLOCK: StatsClock = { now: () => Date.now(), random: () => Math.random() };

/** Injection token: the release version of this API (`GAUZY_APP_VERSION`). */
export const EVER_STATS_RELEASE = 'EVER_STATS_RELEASE';

/** Why a slot sent nothing. */
export type SlotSkip =
	| 'env'
	| 'config'
	| 'ui'
	| 'lease'
	| 'already_sent'
	| 'retry_pending'
	| 'blocked'
	| 'key_unreadable'
	| 'identity_changed'
	| 'collection_failed';

/** What one slot did. */
export interface SlotResult {
	skipped?: SlotSkip;
	reports: Array<{ period: string; final: boolean; status: StatsReportStatus; httpStatus: number | null; error: string | null }>;
}

const FIRST_SEND_JITTER_MS = 60 * 60 * 1000;
const OVERDUE_DELAY_MS = 10 * 60 * 1000;

/**
 * Sends the report once per UTC day, at a second drawn at random for each report (a fixed time of
 * day would be a signature of the installation).
 *
 * - First report: one day after the identity was created (within the following hour); when the last
 *   report is more than a day old at boot, ten minutes after boot.
 * - On days 1 to 3 of a month, the previous month is sent once more with `final: true`.
 * - Nothing is sent while the operator switched the statistics off (`statsEnabledUi`).
 * - Several API processes on one database: a compare-and-set lease lets one send; the others skip the
 *   day once it is sent.
 * - Failed sends (429, 5xx, no answer) are retried at +1 h, +4 h, +12 h, then the next day. After a
 *   report Ever Platform refused (422, or 409 `key_mismatch`) nothing is sent until the module
 *   version, the Gauzy release or the identity changes; after 400, 413 or 415, also at most 7 days.
 * - Nothing is sent, and no lease, key or count is read, while `EVER_STATS_ENABLED=false` (re-read at
 *   run time) or while `EVER_STATS_API_URL` is set to an address that cannot be used.
 *
 * `EVER_STATS_SEND_INTERVAL_S` shortens the day for tests; every delay above scales with it.
 */
@Injectable()
export class EverStatsScheduler implements OnModuleDestroy {
	private readonly logger = new Logger('EverStats');
	private readonly clock: StatsClock;
	private readonly env: Record<string, string | undefined>;
	private readonly holder = randomUUID();
	private timer: NodeJS.Timeout | null = null;
	private nextAt: number | null = null;
	private running: Promise<SlotResult> | null = null;
	private retryAttempt = 0;
	private stopped = true;

	constructor(
		@Inject(EVER_STATS_CONFIG) private readonly config: EverStatsConfig,
		private readonly instance: EverInstanceService,
		private readonly store: EverStatsStore,
		private readonly collector: EverStatsCollector,
		private readonly builder: EverStatsBuilder,
		private readonly sender: EverStatsSender,
		@Optional() @Inject(EVER_STATS_CLOCK) clock?: StatsClock,
		@Optional() @Inject(EVER_STATS_RELEASE) private readonly releaseRaw?: string,
		@Optional() @Inject(EVER_STATS_ENV) env?: Record<string, string | undefined>
	) {
		this.clock = clock ?? SYSTEM_CLOCK;
		this.env = env ?? process.env;
	}

	private get intervalMs(): number {
		return this.config.intervalS * 1000;
	}

	/** A delay of the daily schedule, scaled when a test shortens the day. */
	private scaled(ms: number): number {
		return Math.max(1000, Math.round((ms * this.config.intervalS) / 86_400));
	}

	/** The start of the slot (UTC day) that contains `at`. */
	private slotStart(at: number): number {
		return Math.floor(at / this.intervalMs) * this.intervalMs;
	}

	/** A random second of the slot after the one that contains `at`. */
	private nextSlot(at: number): number {
		return this.slotStart(at) + this.intervalMs + Math.floor(this.clock.random() * this.intervalMs);
	}

	/** When the next report is due in this process, or `null` when nothing is scheduled. */
	nextSendAt(): number | null {
		return this.nextAt;
	}

	/** Starts the schedule. No request is made here; the first one is a day away (ten minutes when overdue). */
	async start(): Promise<void> {
		this.stopped = false;
		const identity = await this.instance.ensure();
		await this.store.ensureLease();
		const lease = await this.store.readLease();
		this.schedule(this.firstSendAt(identity, lease.lastSentAt, this.clock.now()));
	}

	/** The first send of this process. */
	firstSendAt(identity: Pick<EverInstanceRecord, 'createdAt'>, lastSentAt: number | null, now: number): number {
		const reference = lastSentAt ?? identity.createdAt;
		if (now - reference >= this.intervalMs) {
			const delay = Math.min(OVERDUE_DELAY_MS, this.intervalMs);
			return now + delay + Math.floor(this.clock.random() * delay);
		}
		if (lastSentAt === null) {
			return identity.createdAt + this.intervalMs + Math.floor(this.clock.random() * Math.min(FIRST_SEND_JITTER_MS, this.intervalMs));
		}
		return Math.max(this.nextSlot(lastSentAt), now + 1000);
	}

	stop(): void {
		this.stopped = true;
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		this.nextAt = null;
	}

	onModuleDestroy(): void {
		this.stop();
	}

	private schedule(at: number): void {
		if (this.stopped) {
			return;
		}
		if (this.timer) {
			clearTimeout(this.timer);
		}
		this.nextAt = at;
		const delay = Math.max(0, at - this.clock.now());
		// setTimeout holds at most ~24.8 days; a longer wait re-arms itself.
		this.timer = setTimeout(() => void this.onTimer(), Math.min(delay, 2_000_000_000));
		this.timer.unref?.();
	}

	private async onTimer(): Promise<void> {
		this.timer = null;
		if (this.nextAt !== null && this.clock.now() < this.nextAt) {
			this.schedule(this.nextAt);
			return;
		}
		let next: number;
		try {
			const result = await this.runSlot('schedule');
			next = this.nextAfter(result);
		} catch (error) {
			this.logger.warn(`The anonymous usage statistics slot failed: ${(error as Error)?.name ?? 'Error'}.`);
			next = this.nextSlot(this.clock.now());
		}
		this.schedule(next);
	}

	/** When to try again after a slot. */
	nextAfter(result: SlotResult): number {
		const now = this.clock.now();
		const retry = !result.skipped && result.reports.some((r) => r.status === 'failed' && r.error?.startsWith('retry:'));
		if (retry) {
			const delay = STATS_RETRY_DELAYS_S[Math.min(this.retryAttempt, STATS_RETRY_DELAYS_S.length - 1)] * 1000;
			this.retryAttempt += 1;
			return now + this.scaled(delay);
		}
		this.retryAttempt = 0;
		return this.nextSlot(now);
	}

	/**
	 * Runs one slot now: builds, signs, stores and sends the report(s) due. Two calls never overlap in
	 * one process; across processes the lease decides.
	 */
	async runSlot(trigger: 'schedule' | 'send_now'): Promise<SlotResult> {
		if (this.running) {
			return this.running;
		}
		this.running = this.slot(trigger).finally(() => {
			this.running = null;
		});
		return this.running;
	}

	private async slot(trigger: 'schedule' | 'send_now'): Promise<SlotResult> {
		if (!isEverStatsEnabled(this.env)) {
			return { skipped: 'env', reports: [] };
		}
		if (!this.config.apiUrl) {
			return { skipped: 'config', reports: [] };
		}
		const apiUrl = this.config.apiUrl;
		const identity = await this.instance.ensure();
		if (!identity.statsEnabledUi) {
			return { skipped: 'ui', reports: [] };
		}
		const now = this.clock.now();
		if (!(await this.store.acquireLease(this.holder, now, STATS_LEASE_MS))) {
			return { skipped: 'lease', reports: [] };
		}
		let signer: EverStatsSigner | null = null;
		try {
			const lease = await this.store.readLease();
			const recent = await this.store.latest(STATS_REPORTS_KEPT);
			const retrying = this.retryAttempt > 0;
			if (trigger === 'schedule' && !retrying && lease.lastSentAt !== null && this.slotStart(lease.lastSentAt) === this.slotStart(now)) {
				return { skipped: 'already_sent', reports: [] };
			}
			// A failed send waits for its retry time on every API process, not only on the one that sent it.
			if (trigger === 'schedule' && !retrying && now < this.retryPendingUntil(recent)) {
				return { skipped: 'retry_pending', reports: [] };
			}
			const release = parseReleaseVersion(this.releaseRaw ?? process.env['GAUZY_APP_VERSION']);
			if (this.blocked(recent, identity.instanceId, release.version, now)) {
				return { skipped: 'blocked', reports: [] };
			}
			try {
				// Only the key of the identity the report is built for: a reset in between is refused.
				signer = await this.instance.statsSigner({ instanceId: identity.instanceId, statsKeyId: identity.statsKeyId });
			} catch (error) {
				if (error instanceof EverInstanceKeyError) {
					this.logger.warn('The statistics key of this installation cannot be read with the current secrets; nothing is sent. Reset the instance identity in Settings to make a new one.');
					return { skipped: 'key_unreadable', reports: [] };
				}
				if (error instanceof EverInstanceIdentityChangedError) {
					return { skipped: 'identity_changed', reports: [] };
				}
				throw error;
			}
			const at = new Date(now);
			const due: Array<{ period: StatsPeriod; final: boolean }> = [];
			const previous = statsPeriod(at, 1);
			if (at.getUTCDate() <= 3 && !this.finalSent(recent, previous.label, identity.instanceId)) {
				due.push({ period: previous, final: true });
			}
			due.push({ period: statsPeriod(at), final: false });
			const result: SlotResult = { reports: [] };
			for (const { period, final } of due) {
				let collected;
				try {
					collected = await this.collector.collect(period, at);
				} catch (error) {
					const timedOut = error instanceof StatsCollectionTimeout;
					this.logger.warn(`The anonymous usage statistics could not be collected (${timedOut ? 'timeout' : 'database error'}); no report in this slot.`);
					if (timedOut) {
						// Keep the lease while the abandoned queries still run (at most until it expires), so
						// no other process starts the same scan alongside them.
						await this.settleWithinLease(error.pending, now);
					}
					return { skipped: 'collection_failed', reports: result.reports };
				}
				const built = this.builder.build({ identity, config: this.config, release, period, final, collected, now: at });
				const row: StoredStatsReport = {
					id: randomUUID(),
					period: period.label,
					payload: built.text,
					status: built.ok ? 'pending' : 'rejected',
					httpStatus: null,
					attempts: this.retryAttempt + 1,
					lastError: built.ok ? null : built.error,
					sentAt: null,
					createdAt: this.clock.now()
				};
				await this.store.insertReport(row);
				if (!built.ok) {
					this.logger.warn(`An anonymous usage statistics report was refused before sending (${built.error}); nothing was sent.`);
					result.reports.push({ period: period.label, final, status: 'rejected', httpStatus: null, error: built.error });
					continue;
				}
				// The last moment the operator's switch is read: switched off while the report was being
				// prepared, it is not sent.
				if (!(await this.instance.get())?.statsEnabledUi) {
					await this.store.updateReport(row.id, { status: 'rejected', lastError: 'switched_off' });
					return { skipped: 'ui', reports: result.reports };
				}
				const outcome = await this.sender.send(apiUrl, built.built.bytes, signer, release.version);
				const update = this.rowUpdate(outcome);
				await this.store.updateReport(row.id, update);
				if (outcome.kind === 'accepted') {
					await this.store.markSent(update.sentAt as number);
				} else {
					this.logger.warn(`The anonymous usage statistics report was not accepted (${update.lastError}).`);
				}
				result.reports.push({ period: period.label, final, status: update.status, httpStatus: update.httpStatus, error: update.lastError });
			}
			return result;
		} finally {
			signer?.dispose();
			await this.store.releaseLease(this.holder, this.clock.now()).catch(() => undefined);
			await this.store.prune(STATS_REPORTS_KEPT).catch(() => undefined);
		}
	}

	/** Waits for `pending` to settle, but not past the end of the lease taken at `leasedAt`. */
	private async settleWithinLease(pending: Promise<unknown>, leasedAt: number): Promise<void> {
		const remaining = leasedAt + STATS_LEASE_MS - this.clock.now() - 1000;
		if (remaining <= 0) {
			return;
		}
		let timer: NodeJS.Timeout | undefined;
		const leaseEnd = new Promise<void>((resolve) => {
			timer = setTimeout(resolve, remaining);
			timer.unref?.();
		});
		try {
			await Promise.race([pending.then(() => undefined, () => undefined), leaseEnd]);
		} finally {
			clearTimeout(timer);
		}
	}

	private rowUpdate(outcome: StatsSendOutcome): { status: StatsReportStatus; httpStatus: number | null; lastError: string | null; sentAt: number } {
		const sentAt = this.clock.now();
		switch (outcome.kind) {
			case 'accepted':
				return { status: 'sent', httpStatus: 202, lastError: null, sentAt };
			case 'retry':
				return { status: 'failed', httpStatus: outcome.status, lastError: `retry:${outcome.error}`.slice(0, 255), sentAt };
			case 'reset_identity':
				return { status: 'rejected', httpStatus: 409, lastError: `reset_identity:${outcome.error}`.slice(0, 255), sentAt };
			case 'dropped':
				return { status: 'rejected', httpStatus: outcome.status, lastError: `dropped:${outcome.error}`.slice(0, 255), sentAt };
			default:
				return { status: 'failed', httpStatus: outcome.status, lastError: `later:${outcome.error}`.slice(0, 255), sentAt };
		}
	}

	/**
	 * Until when the last failed send makes every process wait: its retry time (+1 h, +4 h, +12 h, then a
	 * day, by attempt) after a 429, 5xx or no answer; the next slot after any other failure.
	 */
	retryPendingUntil(recent: StoredStatsReport[]): number {
		const last = recent[0];
		if (!last || last.status !== 'failed' || last.sentAt === null) {
			return 0;
		}
		if (last.lastError?.startsWith('retry:')) {
			const delay = STATS_RETRY_DELAYS_S[Math.min(Math.max(last.attempts - 1, 0), STATS_RETRY_DELAYS_S.length - 1)] * 1000;
			return last.sentAt + this.scaled(delay);
		}
		return this.slotStart(last.sentAt) + this.intervalMs;
	}

	/**
	 * Whether the last refusal of Ever Platform still holds: it was for this module version, this
	 * Gauzy release (`version`) and this identity, and, unless it was a 422 or a 409, it is less than
	 * 7 days old. Any of these changing lets the next report go out.
	 */
	private blocked(recent: StoredStatsReport[], instanceId: string, version: string, now: number): boolean {
		const last = recent.find((r) => r.status === 'sent' || (r.status === 'rejected' && /^(dropped|reset_identity):/.test(r.lastError ?? '')));
		if (!last || last.status === 'sent') {
			return false;
		}
		const payload = this.parse(last.payload);
		if (payload?.['module_version'] !== MODULE_VERSION || payload?.['instance_id'] !== instanceId || payload?.['version'] !== version) {
			return false;
		}
		if (last.httpStatus === 422 || last.httpStatus === 409) {
			return true;
		}
		return now - (last.sentAt ?? last.createdAt) < this.scaled(STATS_REFUSAL_PARK_MS);
	}

	/** Whether the closed report of `period` was accepted for this identity. */
	private finalSent(recent: StoredStatsReport[], period: string, instanceId: string): boolean {
		return recent.some((r) => {
			if (r.status !== 'sent' || r.period !== period) return false;
			const payload = this.parse(r.payload);
			return payload?.['final'] === true && payload?.['instance_id'] === instanceId;
		});
	}

	private parse(payload: string | null): Record<string, unknown> | null {
		try {
			return payload ? (JSON.parse(payload) as Record<string, unknown>) : null;
		} catch {
			return null;
		}
	}
}

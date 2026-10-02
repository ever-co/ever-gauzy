import { Inject, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EverInstanceKeyError, EverInstanceRecord, EverInstanceService } from '@gauzy/plugin-ever-instance';
import { STATS_LEASE_MS, STATS_REPORTS_KEPT, STATS_RETRY_DELAYS_S, MODULE_VERSION } from './ever-stats.constants';
import { EverStatsConfig } from './ever-stats-config';
import { EverStatsBuilder, parseReleaseVersion } from './ever-stats-builder.service';
import { EverStatsCollector, statsPeriod, StatsPeriod } from './ever-stats-collector.service';
import { EverStatsSender, StatsSendOutcome } from './ever-stats-sender.service';
import { EverStatsStore, StatsReportStatus, StoredStatsReport } from './ever-stats.store';

/** Injection token: the settings read at boot. */
export const EVER_STATS_CONFIG = 'EVER_STATS_CONFIG';

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
export type SlotSkip = 'ui' | 'lease' | 'already_sent' | 'blocked' | 'key_unreadable' | 'collection_failed';

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
 * - Failed sends (429, 5xx, no answer) are retried at +1 h, +4 h, +12 h, then the next day. A report
 *   Ever Platform refused (422 and alike, or 409 `key_mismatch`) is not sent again until the module
 *   version or the identity changes.
 *
 * `EVER_STATS_SEND_INTERVAL_S` shortens the day for tests; every delay above scales with it.
 */
@Injectable()
export class EverStatsScheduler implements OnModuleDestroy {
	private readonly logger = new Logger('EverStats');
	private readonly clock: StatsClock;
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
		@Optional() @Inject(EVER_STATS_RELEASE) private readonly releaseRaw?: string
	) {
		this.clock = clock ?? SYSTEM_CLOCK;
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
		const identity = await this.instance.ensure();
		if (!identity.statsEnabledUi) {
			return { skipped: 'ui', reports: [] };
		}
		const now = this.clock.now();
		if (!(await this.store.acquireLease(this.holder, now, STATS_LEASE_MS))) {
			return { skipped: 'lease', reports: [] };
		}
		try {
			const lease = await this.store.readLease();
			const recent = await this.store.latest(STATS_REPORTS_KEPT);
			const retrying = this.retryAttempt > 0;
			if (trigger === 'schedule' && !retrying && lease.lastSentAt !== null && this.slotStart(lease.lastSentAt) === this.slotStart(now)) {
				return { skipped: 'already_sent', reports: [] };
			}
			if (this.blocked(recent, identity.instanceId)) {
				return { skipped: 'blocked', reports: [] };
			}
			let signer;
			try {
				signer = await this.instance.statsSigner();
			} catch (error) {
				if (error instanceof EverInstanceKeyError) {
					this.logger.warn('The statistics key of this installation cannot be read with the current secrets; nothing is sent. Reset the instance identity in Settings to make a new one.');
					return { skipped: 'key_unreadable', reports: [] };
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
			const release = parseReleaseVersion(this.releaseRaw ?? process.env['GAUZY_APP_VERSION']);
			const result: SlotResult = { reports: [] };
			for (const { period, final } of due) {
				let collected;
				try {
					collected = await this.collector.collect(period);
				} catch (error) {
					this.logger.warn(`The anonymous usage statistics could not be collected (${(error as Error)?.message === 'collection_timeout' ? 'timeout' : 'database error'}); no report in this slot.`);
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
				const outcome = await this.sender.send(this.config.apiUrl, built.built.bytes, signer, release.version);
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
			await this.store.releaseLease(this.holder, this.clock.now()).catch(() => undefined);
			await this.store.prune(STATS_REPORTS_KEPT).catch(() => undefined);
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

	/** A report Ever Platform refused for good, for this module version and this identity. */
	private blocked(recent: StoredStatsReport[], instanceId: string): boolean {
		const last = recent.find((r) => r.status === 'sent' || (r.status === 'rejected' && /^(dropped|reset_identity):/.test(r.lastError ?? '')));
		if (!last || last.status === 'sent') {
			return false;
		}
		const payload = this.parse(last.payload);
		return payload?.['module_version'] === MODULE_VERSION && payload?.['instance_id'] === instanceId;
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

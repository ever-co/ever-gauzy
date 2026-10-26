import { ConflictException, HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EverInstanceRecord, EverInstanceService } from '@gauzy/plugin-ever-instance';
import {
	MAX_STATS_REPORT_BYTES,
	STATS_LEASE_MS,
	STATS_PREVIEW_INTERVAL_MS,
	STATS_SCHEMA_URL,
	STATS_SEND_NOW_INTERVAL_MS
} from './ever-stats.constants';
import type { EverStatsConfig } from './ever-stats-config';
import { EverStatsBuilder, parseReleaseVersion } from './ever-stats-builder.service';
import { EverStatsCollector, statsPeriod } from './ever-stats-collector.service';
import { EVER_STATS_CLOCK, EVER_STATS_CONFIG, EVER_STATS_RELEASE, EverStatsScheduler } from './ever-stats-scheduler.service';
import type { SlotResult, StatsClock } from './ever-stats-scheduler.service';
import { EverStatsStore, StoredStatsReport } from './ever-stats.store';

/**
 * Why nothing is sent: `ui` (switched off in Settings), `config` (`EVER_STATS_API_URL` is set to an
 * address that cannot be used), `key_unreadable` (the stored statistics key cannot be read with the
 * current `ENCRYPTION_KEY`/`JWT_SECRET`; *Reset instance identity* makes a new one).
 */
export type EverStatsStopReason = 'ui' | 'config' | 'key_unreadable';

/** `GET /ever-stats/status`. */
export interface EverStatsStatus {
	enabled: boolean;
	/** Why nothing is sent, or `null` while reports go out. */
	reason: EverStatsStopReason | null;
	install_source: string;
	/** The anonymous id, once Ever Platform accepted a report under it (`null` before). */
	instance_id: string | null;
	key_id: string;
	serves: string[];
	country: string;
	/** Where reports go, or `null` when the configured address cannot be used. */
	api_url: string | null;
	next_send_at: string | null;
	last_attempt: {
		status: string;
		http_status: number | null;
		period: string;
		at: string | null;
		error: string | null;
	} | null;
	key_warning: string | null;
	schema_url: string;
}

/** `GET /ever-stats/last`: the exact bytes of the last report sent, and what happened to it. */
export interface EverStatsLastPayload {
	payload: string;
	bytes: number;
	sent_at: string | null;
	http_status: number | null;
	status: string;
	period: string;
}

/** `POST /ever-stats/preview`: the report as it would be sent now (nothing is stored or sent). */
export interface EverStatsPreview {
	valid: boolean;
	error: string | null;
	payload: string;
	bytes: number;
	max_bytes: number;
}

const iso = (ms: number | null): string | null => (ms ? new Date(ms).toISOString() : null);

/** What the operator routes do. */
@Injectable()
export class EverStatsService {
	private lastSendNowAt = 0;
	private lastPreview: { at: number; instanceId: string; preview: Promise<EverStatsPreview> } | null = null;
	/** The lease holder of this process's *Reset instance identity*. */
	private readonly resetHolder = `reset:${randomUUID()}`;

	constructor(
		@Inject(EVER_STATS_CONFIG) private readonly config: EverStatsConfig,
		private readonly instance: EverInstanceService,
		private readonly store: EverStatsStore,
		private readonly scheduler: EverStatsScheduler,
		private readonly collector: EverStatsCollector,
		private readonly builder: EverStatsBuilder,
		@Optional() @Inject(EVER_STATS_CLOCK) private readonly clock?: StatsClock,
		@Optional() @Inject(EVER_STATS_RELEASE) private readonly releaseRaw?: string
	) {}

	private now(): number {
		return this.clock ? this.clock.now() : Date.now();
	}

	/** Whether the statistics are on (for the paired Ever Teams web app). */
	async enabled(): Promise<boolean> {
		return (await this.instance.ensure()).statsEnabledUi;
	}

	async status(): Promise<EverStatsStatus> {
		const identity = await this.instance.ensure();
		const recent = await this.store.latest();
		const last = recent[0] ?? null;
		const accepted = recent.some((row) => row.status === 'sent' && row.payload !== null && this.instanceOf(row.payload) === identity.instanceId);
		const reason = await this.stopReason(identity);
		return {
			enabled: identity.statsEnabledUi,
			reason,
			install_source: this.config.installSource,
			instance_id: accepted ? identity.instanceId : null,
			key_id: identity.statsKeyId,
			serves: [...this.config.serves],
			country: this.config.country,
			api_url: this.config.apiUrl,
			next_send_at: reason === null ? iso(this.scheduler.nextSendAt()) : null,
			last_attempt: last
				? { status: last.status, http_status: last.httpStatus, period: last.period, at: iso(last.sentAt ?? last.createdAt), error: last.lastError }
				: null,
			key_warning: this.instance.keyWarning(identity.statsKeySource),
			schema_url: STATS_SCHEMA_URL
		};
	}

	/** Why nothing is sent now, or `null` while reports go out. */
	private async stopReason(identity: EverInstanceRecord): Promise<EverStatsStopReason | null> {
		if (!identity.statsEnabledUi) {
			return 'ui';
		}
		if (!this.config.apiUrl) {
			return 'config';
		}
		if (!(await this.instance.statsKeyReadable())) {
			return 'key_unreadable';
		}
		return null;
	}

	/**
	 * The last report of the current identity that went out (accepted or not), or `null` when none
	 * did. After *Reset instance identity* the reports of the previous identity are not shown.
	 */
	async last(): Promise<EverStatsLastPayload | null> {
		const { instanceId } = await this.instance.ensure();
		const rows: StoredStatsReport[] = await this.store.latest();
		const sent = rows.find((row) => row.sentAt !== null && row.payload !== null && this.instanceOf(row.payload) === instanceId);
		if (!sent) {
			return null;
		}
		return {
			payload: sent.payload as string,
			bytes: Buffer.byteLength(sent.payload as string, 'utf8'),
			sent_at: iso(sent.sentAt),
			http_status: sent.httpStatus,
			status: sent.status,
			period: sent.period
		};
	}

	private instanceOf(payload: string): string | null {
		try {
			const id = (JSON.parse(payload) as { instance_id?: unknown }).instance_id;
			return typeof id === 'string' ? id : null;
		} catch {
			return null;
		}
	}

	/**
	 * Builds the report of the current month as it would be sent now. Nothing is stored or sent.
	 * Within a minute of the previous one (in this process, for the same identity) the previous one is
	 * shown again, and requests that arrive while one is being built share it, so clicks do not
	 * multiply the collection on a large database. A failed build is not kept.
	 */
	async preview(): Promise<EverStatsPreview> {
		const identity = await this.instance.ensure();
		const nowMs = this.now();
		const cached = this.lastPreview;
		if (cached?.instanceId === identity.instanceId && nowMs - cached.at < STATS_PREVIEW_INTERVAL_MS) {
			return cached.preview;
		}
		const entry = { at: nowMs, instanceId: identity.instanceId, preview: this.buildPreview(identity, nowMs) };
		this.lastPreview = entry;
		entry.preview.catch(() => {
			if (this.lastPreview === entry) {
				this.lastPreview = null;
			}
		});
		return entry.preview;
	}

	private async buildPreview(identity: EverInstanceRecord, nowMs: number): Promise<EverStatsPreview> {
		const at = new Date(nowMs);
		const period = statsPeriod(at);
		const collected = await this.collector.collect(period, at);
		const release = parseReleaseVersion(this.releaseRaw ?? process.env['GAUZY_APP_VERSION']);
		const built = this.builder.build({ identity, config: this.config, release, period, final: false, collected, now: at });
		const text = built.text;
		return {
			valid: built.ok,
			error: built.ok ? null : built.error,
			payload: text,
			bytes: Buffer.byteLength(text, 'utf8'),
			max_bytes: MAX_STATS_REPORT_BYTES
		};
	}

	async setEnabled(enabled: boolean, actorId: string | null): Promise<EverStatsStatus> {
		await this.instance.setStatsEnabledUi(enabled, actorId);
		this.lastPreview = null;
		return this.status();
	}

	/** Sends now. 409 while switched off; 429 within 10 minutes of the previous "Send now". */
	async sendNow(): Promise<SlotResult> {
		if (!(await this.instance.ensure()).statsEnabledUi) {
			throw new ConflictException('The anonymous usage statistics are switched off.');
		}
		const now = this.now();
		// The newest stored report counts too, so the limit holds across API processes.
		const newest = (await this.store.latest(1))[0];
		const lastSend = Math.max(this.lastSendNowAt, newest?.createdAt ?? 0);
		if (now - lastSend < STATS_SEND_NOW_INTERVAL_MS) {
			throw new HttpException('Send now can be used once every 10 minutes.', HttpStatus.TOO_MANY_REQUESTS);
		}
		this.lastSendNowAt = now;
		return this.scheduler.runSlot('send_now');
	}

	/**
	 * New statistics id and key. Runs under the sending lease, so it never lands between the
	 * collection and the send of a report on any API process: 409 while a report is being sent.
	 */
	async resetIdentity(actorId: string | null): Promise<EverStatsStatus> {
		const now = this.now();
		if (!(await this.store.acquireLease(this.resetHolder, now, STATS_LEASE_MS))) {
			throw new ConflictException({ statusCode: HttpStatus.CONFLICT, code: 'send_in_progress', message: 'A report is being sent; try again in a minute.' });
		}
		try {
			await this.instance.resetIdentity(actorId);
		} finally {
			await this.store.releaseLease(this.resetHolder, this.now()).catch(() => undefined);
		}
		this.lastPreview = null;
		return this.status();
	}
}

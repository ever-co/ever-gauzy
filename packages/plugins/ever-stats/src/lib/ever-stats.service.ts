import { ConflictException, HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { EverInstanceService } from '@gauzy/plugin-ever-instance';
import { MAX_STATS_REPORT_BYTES, STATS_SCHEMA_URL, STATS_SEND_NOW_INTERVAL_MS } from './ever-stats.constants';
import type { EverStatsConfig } from './ever-stats-config';
import { EverStatsBuilder, parseReleaseVersion } from './ever-stats-builder.service';
import { EverStatsCollector, statsPeriod } from './ever-stats-collector.service';
import { EVER_STATS_CLOCK, EVER_STATS_CONFIG, EVER_STATS_RELEASE, EverStatsScheduler } from './ever-stats-scheduler.service';
import type { SlotResult, StatsClock } from './ever-stats-scheduler.service';
import { EverStatsStore, StoredStatsReport } from './ever-stats.store';

/** `GET /ever-stats/status`. */
export interface EverStatsStatus {
	enabled: boolean;
	/** Why nothing is sent: `ui` when the operator switched it off. */
	reason: 'ui' | null;
	install_source: string;
	instance_id: string;
	key_id: string;
	serves: string[];
	country: string;
	api_url: string;
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
		const last = (await this.store.latest(1))[0] ?? null;
		return {
			enabled: identity.statsEnabledUi,
			reason: identity.statsEnabledUi ? null : 'ui',
			install_source: this.config.installSource,
			instance_id: identity.instanceId,
			key_id: identity.statsKeyId,
			serves: [...this.config.serves],
			country: this.config.country,
			api_url: this.config.apiUrl,
			next_send_at: identity.statsEnabledUi ? iso(this.scheduler.nextSendAt()) : null,
			last_attempt: last
				? { status: last.status, http_status: last.httpStatus, period: last.period, at: iso(last.sentAt ?? last.createdAt), error: last.lastError }
				: null,
			key_warning: this.instance.keyWarning(),
			schema_url: STATS_SCHEMA_URL
		};
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

	/** Builds the report of the current month as it would be sent now. Nothing is stored or sent. */
	async preview(): Promise<EverStatsPreview> {
		const identity = await this.instance.ensure();
		const at = new Date(this.now());
		const period = statsPeriod(at);
		const collected = await this.collector.collect(period);
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

	async resetIdentity(actorId: string | null): Promise<EverStatsStatus> {
		await this.instance.resetIdentity(actorId);
		return this.status();
	}
}

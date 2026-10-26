import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MODULE_VERSION, STATS_SCHEMA_ID } from './ever-stats.constants';
import type { EverStatsConfig } from './ever-stats-config';
import { CollectedStats, StatsPeriod } from './ever-stats-collector.service';
import { validateStatsReportBytes } from '@ever-co/connect-sdk';
import { redactStatsPath } from './schema/stats-path';

/** The release this API runs, without any suffix (a fork's build string could name a company), and its channel. */
export interface ReleaseVersion {
	version: string;
	channel: 'stable' | 'rc' | 'beta' | 'dev' | 'custom';
}

/**
 * Reads the release from `GAUZY_APP_VERSION` (the git tag baked into the images, such as `v111.47.0`
 * or `v111.47.0-4-gbb20466`). The report carries `major.minor.patch` only; a suffix becomes the
 * channel: `-rc…` rc, `-beta…`/`-alpha…` beta, `-<n>-g<sha>`/`-dev…` dev, anything else custom.
 * Without a release version (a source build) the report says `0.0.0` on the `dev` channel.
 */
export function parseReleaseVersion(raw: string | undefined): ReleaseVersion {
	const value = (raw ?? '').trim().replace(/^v/i, '');
	const match = /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})(.*)$/.exec(value);
	if (!match) {
		return { version: '0.0.0', channel: 'dev' };
	}
	const suffix = match[4];
	let channel: ReleaseVersion['channel'] = 'stable';
	if (suffix) {
		if (/^[-.+]rc([.\-+\d]|$)/i.test(suffix)) channel = 'rc';
		else if (/^[-.+](beta|alpha)([.\-+\d]|$)/i.test(suffix)) channel = 'beta';
		else if (/^-\d+-g[0-9a-f]{4,40}$/i.test(suffix) || /^[-.+](dev|snapshot|nightly)([.\-+\d]|$)/i.test(suffix)) channel = 'dev';
		else channel = 'custom';
	}
	return { version: `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`, channel };
}

/** The identity fields a report carries. */
export interface ReportIdentity {
	instanceId: string;
}

/** A report ready to sign: `bytes` is what is signed, stored and sent, unchanged. */
export interface BuiltStatsReport {
	report: Record<string, unknown>;
	text: string;
	bytes: Buffer;
}

/**
 * The outcome of building a report. `built` is set only when the report passed the checks; a refused
 * report has no bytes to send, only its text (stored locally) and the reason (a field and a code).
 */
export interface StatsBuildResult {
	ok: boolean;
	built: BuiltStatsReport | null;
	text: string;
	error: string | null;
}

/**
 * Assembles an `ever.stats.v1` report, serialises it once and runs on those exact bytes the checks
 * Ever Platform runs (size, strict JSON, the published schema, the calendar date). A report that
 * fails is refused here and never sent; the reason names a field and a code, never a value.
 */
@Injectable()
export class EverStatsBuilder {
	build(input: {
		identity: ReportIdentity;
		config: Pick<EverStatsConfig, 'country' | 'serves' | 'installSource'>;
		release: ReleaseVersion;
		period: StatsPeriod;
		final: boolean;
		collected: CollectedStats;
		now: Date;
	}): StatsBuildResult {
		const report: Record<string, unknown> = {
			schema: STATS_SCHEMA_ID,
			report_id: randomUUID(),
			instance_id: input.identity.instanceId,
			sent_at: input.now.toISOString().slice(0, 10),
			module_version: MODULE_VERSION,
			product: 'gauzy',
			instance_kind: 'backend',
			serves: [...input.config.serves],
			version: input.release.version,
			channel: input.release.channel,
			install_source: input.config.installSource,
			country: input.config.country,
			period: input.period.label,
			final: input.final,
			counts: input.collected.counts,
			features: input.collected.features,
			aggregates: input.collected.aggregates
		};
		return this.check(report);
	}

	/** Serialises `report` once and checks those bytes. */
	check(report: unknown): StatsBuildResult {
		let text: string;
		try {
			text = JSON.stringify(report);
		} catch {
			return { ok: false, built: null, text: '', error: 'schema_violation:(body):type' };
		}
		if (typeof text !== 'string') {
			return { ok: false, built: null, text: '', error: 'schema_violation:(body):type' };
		}
		const bytes = Buffer.from(text, 'utf8');
		// The checks Ever Platform runs, from the SDK.
		const checked = validateStatsReportBytes(bytes);
		if ('error' in checked) {
			const refused = checked.error;
			const first = refused.errors[0];
			const path = first ? redactStatsPath(first.path) || '(body)' : '(body)';
			const reason = refused.status === 413 ? 'too_large' : 'schema_violation';
			return { ok: false, built: null, text, error: `${reason}:${path}:${first?.code ?? 'type'}`.slice(0, 255) };
		}
		return { ok: true, built: { report: report as Record<string, unknown>, text, bytes }, text, error: null };
	}
}

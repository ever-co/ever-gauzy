import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

const BASE = `${API_PREFIX}/ever-stats`;

/** `GET /api/ever-stats/status` (operator only; 404 for everyone else). */
export interface EverStatsStatus {
	enabled: boolean;
	/** Why nothing is sent: switched off here, an unusable `EVER_STATS_API_URL`, or an unreadable key. */
	reason: 'ui' | 'config' | 'key_unreadable' | null;
	install_source: string;
	/** Set once Ever Platform accepted a report under it. */
	instance_id: string | null;
	key_id: string;
	serves: string[];
	country: string;
	/** `null` when the configured address cannot be used (nothing is sent). */
	api_url: string | null;
	next_send_at: string | null;
	last_attempt: { status: string; http_status: number | null; period: string; at: string | null; error: string | null } | null;
	key_warning: 'encryption_key_unset' | 'jwt_secret_default' | 'no_secret' | null;
	schema_url: string;
}

/** `GET /api/ever-stats/last`. */
export interface EverStatsLastPayload {
	payload: string;
	bytes: number;
	sent_at: string | null;
	http_status: number | null;
	status: string;
	period: string;
}

/** `POST /api/ever-stats/preview`. */
export interface EverStatsPreview {
	valid: boolean;
	error: string | null;
	payload: string;
	bytes: number;
	max_bytes: number;
}

/** `POST /api/ever-stats/send-now`. */
export interface EverStatsSendResult {
	skipped?: string;
	reports: Array<{ period: string; final: boolean; status: string; httpStatus: number | null; error: string | null }>;
}

/**
 * The published schema, shown to everyone who is not the operator: the file in the public Ever
 * Platform SDK repository, at the commit the API's copy was taken from.
 */
export const EVER_STATS_SCHEMA_URL =
	'https://github.com/ever-co/ever-connect-sdk/blob/2fd74dad9357a18471292f38012a5f5e4e6d2938/contracts/schemas/ever.stats.v1.json';

/** The operator routes of the anonymous usage statistics. */
@Injectable({ providedIn: 'root' })
export class EverStatsUiService {
	private readonly http = inject(HttpClient);

	status(): Observable<EverStatsStatus> {
		return this.http.get<EverStatsStatus>(`${BASE}/status`);
	}

	last(): Observable<EverStatsLastPayload> {
		return this.http.get<EverStatsLastPayload>(`${BASE}/last`);
	}

	preview(): Observable<EverStatsPreview> {
		return this.http.post<EverStatsPreview>(`${BASE}/preview`, {});
	}

	setEnabled(enabled: boolean): Observable<EverStatsStatus> {
		return this.http.put<EverStatsStatus>(`${BASE}/enabled`, { enabled });
	}

	sendNow(): Observable<EverStatsSendResult> {
		return this.http.post<EverStatsSendResult>(`${BASE}/send-now`, {});
	}

	resetIdentity(): Observable<EverStatsStatus> {
		return this.http.post<EverStatsStatus>(`${BASE}/reset-identity`, { confirm: true });
	}
}

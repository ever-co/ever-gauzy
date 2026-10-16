import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';

const BASE = `${API_PREFIX}/integration/ever-works`;

/** `GET /api/integration/ever-works/status`; the route exists only where the API loads the plugin. */
export interface EverWorksStatus {
	enabled: true;
	pluginVersion: string;
	contractVersion: string;
	defaultApiUrl: string | null;
	appUrl: string | null;
}

/** The Ever Works routes of the API. Organization routes take `organizationId`. */
@Injectable({ providedIn: 'root' })
export class EverWorksUiService {
	private readonly http = inject(HttpClient);

	private org(organizationId?: string | null): { params: HttpParams } {
		return { params: organizationId ? new HttpParams().set('organizationId', organizationId) : new HttpParams() };
	}

	status(organizationId?: string | null): Observable<EverWorksStatus> {
		return this.http.get<EverWorksStatus>(`${BASE}/status`, this.org(organizationId));
	}
}

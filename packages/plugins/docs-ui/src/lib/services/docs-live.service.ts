import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, map, Observable } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { RealtimeSocketService } from '@gauzy/ui-core/core';
import type { IDocumentLiveFrame } from '../editor/live/document-live.binding';

const DOCUMENT_LIVE_SUBSCRIPTION = `subscription DocumentLive($documentId: ID!, $connectionId: String!) {
	documentLive(documentId: $documentId, connectionId: $connectionId) {
		kind
		documentId
		update
		stateVector
		awareness
		readOnly
		reason
		revision
		lineage
	}
}`;

/**
 * The platform's live editing sessions of Docs pages (`GAUZY_DOCS_LIVE_ENABLED`): whether they are served, a page's
 * frames over the tab's subscription socket, and the routes the editor sends its edits and cursor to.
 */
@Injectable({ providedIn: 'root' })
export class DocsLiveService {
	private readonly API_URL = `${API_PREFIX}/plugins/docs`;

	private availability: Promise<boolean> | null = null;

	constructor(
		private readonly http: HttpClient,
		private readonly socket: RealtimeSocketService
	) {}

	/**
	 * Whether the platform serves live sessions (`GET /plugins/docs/live/status`; a 404 when the plugin is off). Asked
	 * once per app load; a failure counts as "no" and is asked again next time.
	 */
	available(): Promise<boolean> {
		this.availability ??= firstValueFrom(this.http.get<{ enabled?: boolean }>(`${this.API_URL}/live/status`))
			.then((status) => status?.enabled === true)
			.catch(() => {
				this.availability = null;
				return false;
			});
		return this.availability;
	}

	/**
	 * A page's live session frames.
	 *
	 * @param documentId The page.
	 * @param connectionId This editor's connection id.
	 */
	frames(documentId: ID, connectionId: string): Observable<IDocumentLiveFrame> {
		return this.socket
			.subscribe<{ documentLive: IDocumentLiveFrame }>(DOCUMENT_LIVE_SUBSCRIPTION, { documentId, connectionId })
			.pipe(map((data) => data.documentLive));
	}

	/** Sends an edit (a base64 Yjs update). */
	postUpdate(documentId: ID, connectionId: string, update: string): Promise<unknown> {
		return firstValueFrom(
			this.http.post(`${this.API_URL}/documents/${documentId}/live/updates`, { connectionId, update })
		);
	}

	/** Sends this editor's cursor and presence (a base64 awareness update). */
	postAwareness(documentId: ID, connectionId: string, awareness: string): Promise<unknown> {
		return firstValueFrom(
			this.http.post(`${this.API_URL}/documents/${documentId}/live/awareness`, { connectionId, awareness })
		);
	}
}

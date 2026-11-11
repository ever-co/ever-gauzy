import { Injectable, OnDestroy, inject } from '@angular/core';
import { Observable, Subscription, merge } from 'rxjs';
import { environment } from '@gauzy/ui-config';
import { Store } from '../store/store.service';
import { socketUrlFrom } from './graphql-ws.connection';
import { RealtimeSocket, RealtimeSocketStatus } from './realtime-socket';

/**
 * The tab's socket to the platform's GraphQL subscriptions (see {@link RealtimeSocket}), with the signed-in user's
 * credential and selected organization, as the HTTP calls present them.
 *
 * The URL is derived from `environment.API_BASE_URL` (`https://api.example.com` → `wss://api.example.com/graphql`),
 * or from the page's origin when the app is served by the API. When the user or the selected organization changes,
 * the socket is replaced, since the server reads both once, when the socket opens. The platform answers subscriptions
 * only for features that are on (`GAUZY_REALTIME_ENABLED`, `GAUZY_DOCS_LIVE_ENABLED`): a subscription of a feature
 * that is off fails, which is the feature's cue to keep working as it does without a socket.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeSocketService implements OnDestroy {
	private readonly store = inject(Store);

	private readonly socket = new RealtimeSocket({
		url: () =>
			socketUrlFrom(
				null,
				environment.API_BASE_URL,
				typeof window !== 'undefined' ? window.location?.origin : null
			),
		connectionParams: () => {
			const token = this.store.token;
			if (!token) {
				return null;
			}
			const tenantId = this.store.tenantId ?? this.store.user?.tenantId ?? null;
			const organizationId = this.store.selectedOrganization?.id ?? this.store.organizationId ?? null;
			return {
				authorization: `Bearer ${token}`,
				...(tenantId ? { 'tenant-id': tenantId } : {}),
				...(organizationId ? { 'organization-id': organizationId } : {})
			};
		}
	});

	/** Another user or organization: the socket presents the new ones. */
	private readonly identity: Subscription = merge(this.store.user$, this.store.selectedOrganization$).subscribe(() =>
		this.socket.refresh()
	);

	/** Where the tab's socket stands. */
	get status$(): Observable<RealtimeSocketStatus> {
		return this.socket.status$.asObservable();
	}

	/**
	 * Streams one GraphQL subscription over the tab's socket.
	 *
	 * @param query The subscription document.
	 * @param variables Its variables.
	 * @returns The `data` of each result; it fails with `RealtimeSocketUnavailableError` when there is no socket.
	 */
	subscribe<T>(query: string, variables?: Record<string, unknown>): Observable<T> {
		return this.socket.subscribe<T>(query, variables);
	}

	ngOnDestroy(): void {
		this.identity.unsubscribe();
		this.socket.stop();
	}
}

import { Injectable, Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { catchError, debounceTime, map, shareReplay, switchMap } from 'rxjs/operators';
import { IAiChatConfig, IRolePermission, IUser, PermissionsEnum } from '@gauzy/contracts';
import { environment } from '@gauzy/ui-config';
import { Store } from '@gauzy/ui-core/core';

/**
 * Why the AI chat is not available to the current user.
 *
 * Mirrors the gates the chat has to pass, in the order they are checked, so a
 * surface (settings page, sidebar) can explain the *specific* blocker instead
 * of just hiding itself.
 */
export type AiChatUnavailableReason =
	/** No user is logged in yet. */
	| 'not-authenticated'
	/** The user's role lacks `AI_CHAT_ACCESS`. */
	| 'no-permission'
	/** The server turned the feature off (`GAUZY_AI_CHAT_ENABLED=false`). */
	| 'globally-disabled'
	/** No registered provider has usable credentials for this tenant. */
	| 'no-providers'
	/** `GET /api/ai-chat/config` failed — the verdict is unknown. */
	| 'unreachable';

/** Verdict of one availability evaluation. */
export interface IAiChatAvailability {
	/** Whether the chat surfaces (header toggle + sidebar) may be shown. */
	available: boolean;
	/** The closed gate; `null` while available or not yet evaluated. */
	reason: AiChatUnavailableReason | null;
	/** How many registered providers currently have usable credentials. */
	configuredProviders: number;
	/**
	 * False until the first evaluation settled. Consumers use it to stay quiet
	 * instead of flashing a wrong explanation during bootstrap.
	 */
	resolved: boolean;
}

/** Verdict before the first evaluation settles. */
const PENDING: IAiChatAvailability = {
	available: false,
	reason: null,
	configuredProviders: 0,
	resolved: false
};

/**
 * AiChatAvailabilityService
 *
 * Single source of truth for "may this user use the AI chat, and if not, why?".
 *
 * The chat sidebar registration (`provideAiChatSidebar`) pushes the verdict into
 * `ChatSidebarService.available`, and the "AI Providers" settings page renders
 * the same verdict as a human-readable notice. Both read this one evaluation, so
 * the header toggle and the settings page can never disagree.
 *
 * The evaluation re-runs on user / role-permission changes **and** on demand via
 * {@link refresh}: configuring the first provider flips the backend verdict but
 * emits nothing on the store, so without an explicit trigger the chat would stay
 * hidden until a full page reload — which is exactly how users lost it.
 */
@Injectable({ providedIn: 'root' })
export class AiChatAvailabilityService {
	private readonly store = inject(Store);
	private readonly http = inject(HttpClient);

	/** Manual re-evaluation trigger (credential saved / deleted / connected). */
	private readonly refreshTrigger$ = new BehaviorSubject<void>(undefined);

	/**
	 * The current verdict, re-evaluated on login/permission changes and on
	 * {@link refresh}.
	 *
	 * `shareReplay` with `refCount: false` keeps the last verdict for late
	 * subscribers: the settings page is created long after the sidebar
	 * registration subscribed at bootstrap, and must not trigger a second
	 * evaluation just by reading.
	 */
	readonly status$: Observable<IAiChatAvailability> = combineLatest([
		this.store.user$,
		this.store.userRolePermissions$,
		this.refreshTrigger$
	]).pipe(
		debounceTime(100),
		switchMap(([user, rolePermissions]) => this.evaluate(user, rolePermissions)),
		shareReplay({ bufferSize: 1, refCount: false })
	);

	/** The current verdict as a signal (for templates and `computed`). */
	readonly status: Signal<IAiChatAvailability> = toSignal(this.status$, { initialValue: PENDING });

	/** Whether the chat may be shown to the current user. */
	readonly available = computed<boolean>(() => this.status().available);

	/**
	 * Re-evaluates availability now.
	 *
	 * Call after anything that can change the backend verdict — saving,
	 * deleting, enabling/disabling or connecting a provider credential.
	 */
	refresh(): void {
		this.refreshTrigger$.next();
	}

	/**
	 * Runs the gates in order: authenticated → permitted → backend configured.
	 *
	 * @param user - The logged-in user, or `null`/`undefined` when signed out.
	 * @param rolePermissions - The user's role permissions from the store.
	 * @returns An observable emitting the resulting verdict.
	 */
	private evaluate(
		user: IUser | null | undefined,
		rolePermissions: IRolePermission[] | null | undefined
	): Observable<IAiChatAvailability> {
		if (!user) {
			return of<IAiChatAvailability>({
				available: false,
				reason: 'not-authenticated',
				configuredProviders: 0,
				resolved: true
			});
		}

		const permitted = this.isPermitted(rolePermissions, PermissionsEnum.AI_CHAT_ACCESS);
		// `/config` accepts EITHER permission (the settings page needs it too).
		// Asking without either would just log a 403 for every other user, so
		// short-circuit — those users have no AI surface to explain anything on.
		const mayReadConfig = permitted || this.isPermitted(rolePermissions, PermissionsEnum.AI_CHAT_SETTINGS);
		if (!mayReadConfig) {
			return of<IAiChatAvailability>({
				available: false,
				reason: 'no-permission',
				configuredProviders: 0,
				resolved: true
			});
		}

		return this.http.get<IAiChatConfig>(`${environment.API_BASE_URL}/api/ai-chat/config`).pipe(
			map((config): IAiChatAvailability => {
				const configuredProviders = (config?.providers ?? []).filter((provider) => provider.configured).length;

				if (!config?.enabled) {
					return {
						available: false,
						// Trust the server's reason; derive one for older APIs
						// that answer without `disabledReason`.
						reason: config?.disabledReason ?? (configuredProviders ? 'globally-disabled' : 'no-providers'),
						configuredProviders,
						resolved: true
					};
				}

				// The backend is ready but this role may not open the chat — the
				// distinction a tenant admin with only AI_CHAT_SETTINGS hits.
				if (!permitted) {
					return { available: false, reason: 'no-permission', configuredProviders, resolved: true };
				}

				return { available: true, reason: null, configuredProviders, resolved: true };
			}),
			catchError(() =>
				of<IAiChatAvailability>({
					available: false,
					reason: 'unreachable',
					configuredProviders: 0,
					resolved: true
				})
			)
		);
	}

	/**
	 * Whether a permission is present AND enabled in the given role permissions.
	 *
	 * @param rolePermissions - The user's role permissions from the store.
	 * @param permission - The permission to look for.
	 * @returns True when the role grants the permission.
	 */
	private isPermitted(
		rolePermissions: IRolePermission[] | null | undefined,
		permission: PermissionsEnum
	): boolean {
		return (rolePermissions ?? []).some(
			(rolePermission) => rolePermission.permission === permission && rolePermission.enabled
		);
	}
}

import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toObservable } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ITenantUiPreferences, ITenantUiPreferencesUpdateInput, PreferredUiEnum } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { Store } from '../store/store.service';

/** localStorage key that mirrors the last known preference so the very first paint already agrees with it. */
const PREFERRED_UI_STORAGE_KEY = '_preferredUi';

/**
 * Tenant-wide UI preferences: which flavour (Angular or React) of a page that exists in both
 * flavours the tenant wants to see.
 *
 * Read by everyone (routes pick their component with {@link preferredUiCanMatch}), written by
 * tenant administrators from Settings → General. The value is cached per tenant for the session
 * and mirrored to localStorage, so a reload never flashes the wrong flavour while the API answers.
 */
@Injectable({ providedIn: 'root' })
export class TenantUiPreferencesService {
	private readonly http = inject(HttpClient);
	private readonly store = inject(Store);

	private readonly API_URL = `${API_PREFIX}/tenant-ui-preferences`;

	/** The tenant whose preference is currently loaded (a tenant switch invalidates the cache). */
	private loadedForTenantId: string | null = null;
	private pending: Promise<PreferredUiEnum> | null = null;

	/** The current preference — Angular until the API says otherwise. */
	public readonly preferredUi = signal<PreferredUiEnum>(readStoredPreferredUi());
	public readonly preferredUi$ = toObservable(this.preferredUi);
	/** `true` when the tenant asked for the React flavour. */
	public readonly isReact = computed(() => this.preferredUi() === PreferredUiEnum.REACT);

	/**
	 * Resolves the preference for the signed-in tenant, fetching it once per tenant.
	 * Concurrent callers (several `canMatch` guards of one navigation) share the same request.
	 */
	public ensureLoaded(): Promise<PreferredUiEnum> {
		const tenantId = this.store.tenantId ?? this.store.user?.tenantId ?? null;
		if (this.loadedForTenantId === tenantId && this.loadedForTenantId !== null) {
			return Promise.resolve(this.preferredUi());
		}
		if (this.pending) {
			return this.pending;
		}
		this.pending = firstValueFrom(this.http.get<ITenantUiPreferences>(this.API_URL))
			.then((preferences) => {
				this.loadedForTenantId = tenantId;
				this.apply(preferences?.preferredUi);
				return this.preferredUi();
			})
			.catch(() => this.preferredUi()) // offline / 401 during logout: keep the last known value
			.finally(() => (this.pending = null));
		return this.pending;
	}

	/** Re-reads the preference from the API regardless of the cache. */
	public reload(): Promise<PreferredUiEnum> {
		this.loadedForTenantId = null;
		return this.ensureLoaded();
	}

	/**
	 * Persists a new preference for the whole tenant (requires `TENANT_SETTING`) and applies it
	 * locally so the current session switches without a reload.
	 */
	public async update(input: ITenantUiPreferencesUpdateInput): Promise<ITenantUiPreferences> {
		const preferences = await firstValueFrom(this.http.put<ITenantUiPreferences>(this.API_URL, input));
		this.loadedForTenantId = this.store.tenantId ?? this.store.user?.tenantId ?? null;
		this.apply(preferences?.preferredUi);
		return preferences;
	}

	/** Forgets the cached preference (call on logout / tenant switch). */
	public reset(): void {
		this.loadedForTenantId = null;
		this.pending = null;
	}

	private apply(value: PreferredUiEnum | undefined): void {
		const next = isPreferredUi(value) ? value : PreferredUiEnum.ANGULAR;
		this.preferredUi.set(next);
		try {
			localStorage.setItem(PREFERRED_UI_STORAGE_KEY, next);
		} catch {
			// storage unavailable (private mode / quota) — the in-memory value still applies
		}
	}
}

function readStoredPreferredUi(): PreferredUiEnum {
	try {
		const stored = localStorage.getItem(PREFERRED_UI_STORAGE_KEY);
		return isPreferredUi(stored) ? stored : PreferredUiEnum.ANGULAR;
	} catch {
		return PreferredUiEnum.ANGULAR;
	}
}

function isPreferredUi(value: unknown): value is PreferredUiEnum {
	return Object.values(PreferredUiEnum).includes(value as PreferredUiEnum);
}

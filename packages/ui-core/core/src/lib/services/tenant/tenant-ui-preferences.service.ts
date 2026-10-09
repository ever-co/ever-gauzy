import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toObservable } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ITenantUiPreferences, ITenantUiPreferencesUpdateInput, PreferredUiEnum } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { Store } from '../store/store.service';

/** localStorage key prefix; the tenant id is appended so two tenants on one browser never share a mirror. */
const PREFERRED_UI_STORAGE_PREFIX = '_preferredUi';

/**
 * Tenant-wide UI preferences: which flavour (Angular or React) of a page that exists in both
 * flavours the tenant wants to see.
 *
 * Read by everyone (routes pick their component with {@link preferredUiCanMatch}), written by
 * tenant administrators from Settings → General. The value is cached per tenant for the session
 * and mirrored to localStorage PER TENANT, so a reload never flashes the wrong flavour while the
 * API answers — and a tenant switch never shows the previous tenant's flavour.
 */
@Injectable({ providedIn: 'root' })
export class TenantUiPreferencesService {
	private readonly http = inject(HttpClient);
	private readonly store = inject(Store);

	private readonly API_URL = `${API_PREFIX}/tenant-ui-preferences`;

	/** The tenant whose preference the signal currently reflects (`null` = nothing loaded from the API yet). */
	private loadedForTenantId: string | null = null;
	/** The tenant whose local mirror last seeded the signal — re-seed whenever the signed-in tenant differs. */
	private seededForTenantId: string | null = null;
	/** The in-flight request and the tenant it was issued for — a completion for another tenant is ignored. */
	private pending: { tenantId: string | null; promise: Promise<PreferredUiEnum> } | null = null;

	/** The current preference — Angular until the API (or the tenant's local mirror) says otherwise. */
	public readonly preferredUi = signal<PreferredUiEnum>(PreferredUiEnum.ANGULAR);
	public readonly preferredUi$ = toObservable(this.preferredUi);
	/** `true` when the tenant asked for the React flavour. */
	public readonly isReact = computed(() => this.preferredUi() === PreferredUiEnum.REACT);

	constructor() {
		// First paint: the mirror of the tenant that is signed in right now (if any).
		this.seededForTenantId = this.currentTenantId();
		this.preferredUi.set(readStoredPreferredUi(this.seededForTenantId));
	}

	/**
	 * Resolves the preference for the signed-in tenant, fetching it once per tenant.
	 * Concurrent callers (several `canMatch` guards of one navigation) share the same request;
	 * a tenant switch while a request is pending starts a new request for the new tenant and the
	 * old response is discarded.
	 */
	public ensureLoaded(): Promise<PreferredUiEnum> {
		const tenantId = this.currentTenantId();
		if (tenantId !== null && this.loadedForTenantId === tenantId) {
			return Promise.resolve(this.preferredUi());
		}
		if (this.pending && this.pending.tenantId === tenantId) {
			return this.pending.promise;
		}
		// The signal must never carry another tenant's value while this tenant's answer is on its
		// way (nor after a failed request): whenever the signed-in tenant differs from the one that
		// seeded the signal — including "nobody yet" → first tenant — re-seed from THIS tenant's
		// mirror (Angular when there is none).
		if (this.seededForTenantId !== tenantId) {
			this.loadedForTenantId = null;
			this.seededForTenantId = tenantId;
			this.preferredUi.set(readStoredPreferredUi(tenantId));
		}
		const promise = firstValueFrom(this.http.get<ITenantUiPreferences>(this.API_URL))
			.then((preferences) => {
				// Stale completion (the tenant changed meanwhile) — do not touch the signal.
				if (this.currentTenantId() === tenantId) {
					this.loadedForTenantId = tenantId;
					this.apply(tenantId, preferences?.preferredUi);
				}
				return this.preferredUi();
			})
			.catch(() => this.preferredUi()) // offline / 401 during logout: keep the last known value
			.finally(() => {
				if (this.pending?.promise === promise) {
					this.pending = null;
				}
			});
		this.pending = { tenantId, promise };
		return promise;
	}

	/** Re-reads the preference from the API regardless of the cache. */
	public reload(): Promise<PreferredUiEnum> {
		this.loadedForTenantId = null;
		this.pending = null;
		return this.ensureLoaded();
	}

	/**
	 * Persists a new preference for the whole tenant (requires `TENANT_SETTING`) and applies it
	 * locally so the current session switches without a reload.
	 */
	public async update(input: ITenantUiPreferencesUpdateInput): Promise<ITenantUiPreferences> {
		const tenantId = this.currentTenantId();
		const preferences = await firstValueFrom(this.http.put<ITenantUiPreferences>(this.API_URL, input));
		if (this.currentTenantId() === tenantId) {
			this.loadedForTenantId = tenantId;
			this.apply(tenantId, preferences?.preferredUi);
		}
		return preferences;
	}

	/** Forgets the cached preference and this tenant's mirror (call on logout / tenant switch). */
	public reset(): void {
		const tenantId = this.currentTenantId();
		this.loadedForTenantId = null;
		this.seededForTenantId = null;
		this.pending = null;
		try {
			localStorage.removeItem(storageKey(tenantId));
		} catch {
			// storage unavailable — nothing mirrored to forget
		}
		this.preferredUi.set(PreferredUiEnum.ANGULAR);
	}

	private currentTenantId(): string | null {
		return this.store.tenantId ?? this.store.user?.tenantId ?? null;
	}

	private apply(tenantId: string | null, value: PreferredUiEnum | undefined): void {
		const next = isPreferredUi(value) ? value : PreferredUiEnum.ANGULAR;
		this.seededForTenantId = tenantId;
		this.preferredUi.set(next);
		try {
			localStorage.setItem(storageKey(tenantId), next);
		} catch {
			// storage unavailable (private mode / quota) — the in-memory value still applies
		}
	}
}

function storageKey(tenantId: string | null): string {
	return tenantId ? `${PREFERRED_UI_STORAGE_PREFIX}_${tenantId}` : PREFERRED_UI_STORAGE_PREFIX;
}

function readStoredPreferredUi(tenantId: string | null): PreferredUiEnum {
	try {
		const stored = localStorage.getItem(storageKey(tenantId));
		return isPreferredUi(stored) ? stored : PreferredUiEnum.ANGULAR;
	} catch {
		return PreferredUiEnum.ANGULAR;
	}
}

function isPreferredUi(value: unknown): value is PreferredUiEnum {
	return Object.values(PreferredUiEnum).includes(value as PreferredUiEnum);
}

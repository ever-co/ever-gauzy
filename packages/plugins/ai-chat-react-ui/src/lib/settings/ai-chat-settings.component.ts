import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDialogService,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToastrService,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EMPTY, forkJoin, of } from 'rxjs';
import { catchError, filter, finalize, switchMap } from 'rxjs/operators';
import {
	IAiChatProvider,
	IAiProviderCredential,
	IAiProviderCredentialCreateInput,
	IAiProviderCredentialUpdateInput
} from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { ConfirmComponent } from '@gauzy/ui-core/shared';
import { AiChatSettingsService } from './ai-chat-settings.service';

/** Sentinel select value meaning "type a custom model id". */
const CUSTOM_MODEL = '__custom__';

/** sessionStorage key holding the in-flight Connect (PKCE) state. */
const CONNECT_SESSION_KEY = 'gauzy_ai_provider_connect';

/** Typed shape of the per-provider credential form. */
interface ProviderCredentialForm {
	apiKey: FormControl<string>;
	baseUrl: FormControl<string>;
	defaultModel: FormControl<string>;
	customModel: FormControl<string>;
	enabled: FormControl<boolean>;
}

/** Monogram + brand color for the provider tiles (no external logo assets needed). */
const PROVIDER_TILES: Record<string, { monogram: string; color: string }> = {
	'gauzy-ai': { monogram: 'GA', color: '#6e49e8' },
	openrouter: { monogram: 'OR', color: '#4f46e5' },
	'vercel-gateway': { monogram: '▲', color: '#000000' },
	anthropic: { monogram: 'A✱', color: '#d97757' },
	openai: { monogram: 'OA', color: '#10a37f' },
	gemini: { monogram: 'GE', color: '#4285f4' },
	grok: { monogram: 'X', color: '#1a1a1a' }
};

/**
 * AiChatSettingsComponent
 *
 * Per-tenant "AI Providers" (BYOK) settings, structured like the
 * Integrations page as three views on one route (query-param driven, so
 * the browser back button and deep links work):
 *
 * - **list** (default): providers that are already configured (tenant key
 *   or server env) with status/default badges, quick enable toggle and
 *   Configure/Delete actions, plus a "+ Add AI Provider" button.
 * - **catalog** (`?add=1`): all registered providers as logo cards in
 *   their defined order — click one to configure it.
 * - **config** (`?provider=<id>`): the credential form for one provider
 *   (API key, base URL, default model, enabled, default provider), plus a
 *   "Connect" button for providers that support a connect flow (OpenRouter
 *   PKCE) and a "Get API key" link.
 *
 * The OpenRouter PKCE callback also lands here (`?code=...`): the code +
 * the sessionStorage verifier are exchanged server-side for an API key.
 *
 * Requires the `AI_CHAT_SETTINGS` permission (route guard + backend).
 */
@Component({
	selector: 'gz-ai-chat-settings',
	imports: [
		CommonModule,
		ReactiveFormsModule,
		TranslateModule,
		NbBadgeModule,
		NbButtonModule,
		NbCardModule,
		NbFormFieldModule,
		NbIconModule,
		NbInputModule,
		NbSelectModule,
		NbSpinnerModule,
		NbToggleModule,
		NbTooltipModule
	],
	templateUrl: './ai-chat-settings.component.html',
	styleUrls: ['./ai-chat-settings.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiChatSettingsComponent implements OnInit {
	/** Select value meaning "type a custom model id" (used by the template). */
	readonly CUSTOM_MODEL = CUSTOM_MODEL;

	/** Whether the initial config + credentials load is in flight. */
	readonly loading = signal<boolean>(true);
	/** Provider id whose credential is currently being saved (or `null`). */
	readonly saving = signal<string | null>(null);
	/** Provider id whose credential is currently being deleted (or `null`). */
	readonly deleting = signal<string | null>(null);
	/** True while a Connect (PKCE) exchange is being completed. */
	readonly connecting = signal<boolean>(false);
	/** Providers registered on the backend, in their defined display order. */
	readonly providers = signal<IAiChatProvider[]>([]);
	/** The tenant's current default provider id (from the backend config). */
	readonly defaultProviderId = signal<string | null>(null);

	/** Current view: driven by the route query params. */
	readonly view = signal<'list' | 'catalog' | 'config'>('list');
	/** Provider selected in the config view. */
	readonly selectedProviderId = signal<string | null>(null);

	/** The provider object for the config view. */
	readonly selectedProvider = computed<IAiChatProvider | null>(
		() => this.providers().find((provider) => provider.id === this.selectedProviderId()) ?? null
	);

	/** Providers that are configured (tenant key or server env) — the list view rows. */
	readonly configuredProviders = computed<IAiChatProvider[]>(() =>
		this.providers().filter((provider) => provider.configured)
	);

	/** Tenant credentials indexed by provider id (API keys masked). */
	private credentialsByProvider = new Map<string, IAiProviderCredential>();
	/** Per-provider reactive forms indexed by provider id. */
	private forms = new Map<string, FormGroup<ProviderCredentialForm>>();
	/** Provider ids whose API key input is shown as plain text. */
	private revealedKeys = new Set<string>();

	/** Radio control: which provider is the tenant's default for chat. */
	readonly defaultProviderControl = new FormControl<string | null>(null);

	private readonly fb = inject(FormBuilder);
	private readonly store = inject(Store);
	private readonly settingsService = inject(AiChatSettingsService);
	private readonly dialogService = inject(NbDialogService);
	private readonly toastrService = inject(NbToastrService);
	private readonly translateService = inject(TranslateService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);

	ngOnInit(): void {
		// Complete an in-flight Connect flow when the provider redirected back
		// with ?code=... and we still hold the PKCE verifier for this session.
		const code = this.route.snapshot.queryParamMap.get('code');
		const pending = this.readConnectSession();
		if (code && pending) {
			// The exchange stores the key for the CURRENT tenant/organization, so
			// refuse to complete a flow that was started in a different workspace.
			const tenantChanged = pending.tenantId && pending.tenantId !== (this.store.user?.tenantId ?? null);
			const organizationChanged =
				pending.organizationId && pending.organizationId !== (this.store.organizationId ?? null);
			if (tenantChanged || organizationChanged) {
				sessionStorage.removeItem(CONNECT_SESSION_KEY);
				this.toastrService.danger(
					this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.CONNECT_WORKSPACE_MISMATCH'),
					this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.ERROR_TITLE')
				);
				void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
				this.load();
			} else {
				this.completeConnect(pending.providerId, code, pending.verifier);
			}
		} else {
			this.load();
		}

		// Keep the view in sync with the query params (back/forward navigation).
		this.route.queryParamMap.subscribe((params) => {
			const providerId = params.get('provider');
			if (providerId) {
				this.selectedProviderId.set(providerId);
				this.view.set('config');
			} else if (params.get('add') !== null) {
				this.view.set('catalog');
			} else {
				this.view.set('list');
			}
			this.cdr.markForCheck();
		});
	}

	// ── Navigation between the three views ─────────────────────────────

	showList(): void {
		void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
	}

	showCatalog(): void {
		void this.router.navigate([], { relativeTo: this.route, queryParams: { add: 1 } });
	}

	showConfigure(providerId: string): void {
		void this.router.navigate([], { relativeTo: this.route, queryParams: { provider: providerId } });
	}

	// ── Data loading ───────────────────────────────────────────────────

	/**
	 * Loads the provider configuration and tenant credentials, then
	 * (re)builds one credential form per registered provider.
	 */
	load(): void {
		this.loading.set(true);
		// Each call fails soft so one failing does NOT blank the whole page:
		// `/config` (registered providers) and `/credentials` (saved tenant keys)
		// are independent — the catalog must still render when the credentials
		// call fails (keys just aren't pre-filled), and vice versa.
		forkJoin({
			config: this.settingsService.getConfig().pipe(
				catchError((error) => {
					this.showError(error);
					return of(null);
				})
			),
			credentials: this.settingsService.getCredentials().pipe(
				catchError((error) => {
					// Surface the failure — otherwise saved keys silently look
					// unconfigured (toggles/delete disappear) on a transient error.
					this.showError(error);
					return of({ items: [], total: 0 });
				})
			)
		})
			.pipe(finalize(() => this.loading.set(false)))
			.subscribe(({ config, credentials }) => {
				this.credentialsByProvider = new Map(
					(credentials?.items ?? []).map((credential) => [credential.providerId, credential])
				);
				this.providers.set(config?.providers ?? []);
				this.defaultProviderId.set(config?.defaultProvider ?? null);
				this.buildForms();
				// Unknown ?provider= deep link → fall back to the catalog
				// instead of a blank config view.
				if (this.view() === 'config' && this.providers().length && !this.selectedProvider()) {
					this.showCatalog();
				}
				this.cdr.markForCheck();
			});
	}

	// ── Template helpers ───────────────────────────────────────────────

	/** Monogram text for a provider tile. */
	tileMonogram(providerId: string): string {
		return PROVIDER_TILES[providerId]?.monogram ?? providerId.slice(0, 2).toUpperCase();
	}

	/** Brand background color for a provider tile. */
	tileColor(providerId: string): string {
		return PROVIDER_TILES[providerId]?.color ?? '#8f9bb3';
	}

	/** Returns the credential form for a provider. */
	getForm(providerId: string): FormGroup<ProviderCredentialForm> {
		return this.forms.get(providerId);
	}

	/** Returns the tenant credential (masked) for a provider, if any. */
	getCredential(providerId: string): IAiProviderCredential | undefined {
		return this.credentialsByProvider.get(providerId);
	}

	/** Whether the API key input of a provider is shown as plain text. */
	isKeyRevealed(providerId: string): boolean {
		return this.revealedKeys.has(providerId);
	}

	/** Toggles the API key input of a provider between password and plain text. */
	toggleKeyReveal(providerId: string): void {
		if (!this.revealedKeys.delete(providerId)) {
			this.revealedKeys.add(providerId);
		}
	}

	/** Returns the translation key for a provider's configuration badge. */
	getBadgeKey(provider: IAiChatProvider): string {
		if (!provider.configured) {
			return 'AI_CHAT_UI.SETTINGS.BADGE.NOT_CONFIGURED';
		}
		return provider.credentialSource === 'environment'
			? 'AI_CHAT_UI.SETTINGS.BADGE.SERVER_ENV'
			: 'AI_CHAT_UI.SETTINGS.BADGE.TENANT_KEY';
	}

	/** Returns the badge status color for a provider's configuration state. */
	getBadgeStatus(provider: IAiChatProvider): string {
		if (!provider.configured) {
			return 'basic';
		}
		return provider.credentialSource === 'environment' ? 'info' : 'success';
	}

	// ── List view actions ──────────────────────────────────────────────

	/**
	 * Quick enable/disable of a provider's tenant credential from the list.
	 * Only available for tenant-key rows (env credentials have no toggle).
	 */
	toggleEnabled(provider: IAiChatProvider, enabled: boolean): void {
		const credential = this.getCredential(provider.id);
		if (!credential?.id) {
			return;
		}
		this.saving.set(provider.id);
		this.settingsService
			.updateCredential(credential.id, { providerId: provider.id, enabled })
			.pipe(finalize(() => this.saving.set(null)))
			.subscribe({
				next: () => this.load(),
				error: (error) => {
					this.showError(error);
					this.load();
				}
			});
	}

	// ── Connect (PKCE) flow ────────────────────────────────────────────

	/**
	 * Starts the provider's Connect flow: generates a PKCE verifier +
	 * S256 challenge, stashes the verifier in sessionStorage and sends the
	 * browser to the provider's authorize page. The provider redirects back
	 * to this page with `?code=...`.
	 */
	async connect(provider: IAiChatProvider): Promise<void> {
		if (provider.connectType !== 'openrouter-pkce' || !provider.connectAuthorizeUrl) {
			return;
		}
		try {
			const verifier = this.base64Url(crypto.getRandomValues(new Uint8Array(48)));
			const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
			const challenge = this.base64Url(new Uint8Array(digest));
			// Bind the pending flow to the workspace (tenant + organization) it
			// was started in so a mid-flight switch can't store the key elsewhere.
			sessionStorage.setItem(
				CONNECT_SESSION_KEY,
				JSON.stringify({
					providerId: provider.id,
					verifier,
					tenantId: this.store.user?.tenantId ?? null,
					organizationId: this.store.organizationId ?? null
				})
			);

			// The authorize page comes from the provider definition (backend
			// config) so additional connect-capable providers need no UI change.
			const callbackUrl = `${location.origin}${location.pathname}#/pages/settings/ai`;
			const authorizeUrl =
				`${provider.connectAuthorizeUrl}?callback_url=${encodeURIComponent(callbackUrl)}` +
				`&code_challenge=${challenge}&code_challenge_method=S256`;
			location.assign(authorizeUrl);
		} catch (error) {
			this.showError(error);
		}
	}

	/**
	 * Completes a Connect flow after the provider redirected back with a
	 * code: the backend exchanges code + verifier for an API key and stores
	 * it as the tenant credential.
	 */
	private completeConnect(providerId: string, code: string, verifier: string): void {
		this.connecting.set(true);
		sessionStorage.removeItem(CONNECT_SESSION_KEY);
		this.settingsService
			.connectCredential({
				providerId,
				code,
				codeVerifier: verifier,
				organizationId: this.store.organizationId ?? undefined
			})
			.pipe(
				finalize(() => {
					this.connecting.set(false);
					// Strip the one-time ?code=... from the URL.
					void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
					this.load();
				})
			)
			.subscribe({
				next: () => {
					this.toastrService.success(
						this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.CONNECTED', {
							provider: this.providerLabel(providerId)
						}),
						this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.SUCCESS_TITLE')
					);
				},
				error: (error) => this.showError(error)
			});
	}

	private readConnectSession(): {
		providerId: string;
		verifier: string;
		tenantId?: string | null;
		organizationId?: string | null;
	} | null {
		try {
			const raw = sessionStorage.getItem(CONNECT_SESSION_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			return parsed?.providerId && parsed?.verifier ? parsed : null;
		} catch {
			return null;
		}
	}

	private base64Url(bytes: Uint8Array): string {
		return btoa(String.fromCharCode(...bytes))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/g, '');
	}

	private providerLabel(providerId: string): string {
		return this.providers().find((p) => p.id === providerId)?.label ?? providerId;
	}

	// ── Save / delete (config view) ────────────────────────────────────

	/**
	 * Saves the credential of a provider: `POST` (upsert) when the tenant has
	 * no credential yet, `PUT` when one exists. A blank API key on update
	 * keeps the stored key.
	 */
	save(provider: IAiChatProvider): void {
		const form = this.getForm(provider.id);
		if (!form || form.invalid) {
			form?.markAllAsTouched();
			return;
		}

		const value = form.getRawValue();
		const apiKey = value.apiKey?.trim();
		const defaultModel = (value.defaultModel === CUSTOM_MODEL ? value.customModel : value.defaultModel)?.trim();
		const payload: IAiProviderCredentialUpdateInput = {
			providerId: provider.id,
			baseUrl: value.baseUrl?.trim() || undefined,
			enabled: value.enabled,
			isDefault: this.defaultProviderControl.value === provider.id,
			defaultModel: defaultModel || undefined,
			organizationId: this.store.organizationId ?? undefined
		};

		const credential = this.getCredential(provider.id);
		const request$ = credential?.id
			? this.settingsService.updateCredential(credential.id, apiKey ? { ...payload, apiKey } : payload)
			: this.settingsService.upsertCredential({ ...payload, apiKey } as IAiProviderCredentialCreateInput);

		this.saving.set(provider.id);
		request$.pipe(finalize(() => this.saving.set(null))).subscribe({
			next: () => {
				this.toastrService.success(
					this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.SAVED', { provider: provider.label }),
					this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.SUCCESS_TITLE')
				);
				this.load();
				this.showList();
			},
			error: (error) => this.showError(error)
		});
	}

	/** Deletes the tenant credential of a provider after confirmation. */
	delete(provider: IAiChatProvider): void {
		const credential = this.getCredential(provider.id);
		if (!credential?.id) {
			return;
		}

		this.dialogService
			.open(ConfirmComponent, {
				context: {
					data: {
						title: this.translateService.instant('AI_CHAT_UI.SETTINGS.DELETE_CONFIRM.TITLE'),
						message: this.translateService.instant('AI_CHAT_UI.SETTINGS.DELETE_CONFIRM.MESSAGE', {
							provider: provider.label
						})
					}
				}
			})
			.onClose.pipe(
				filter(Boolean),
				switchMap(() => {
					this.deleting.set(provider.id);
					return this.settingsService.deleteCredential(credential.id).pipe(
						finalize(() => this.deleting.set(null)),
						catchError((error) => {
							this.showError(error);
							return EMPTY;
						})
					);
				})
			)
			.subscribe(() => {
				this.toastrService.success(
					this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.DELETED', { provider: provider.label }),
					this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.SUCCESS_TITLE')
				);
				this.load();
			});
	}

	/**
	 * Builds one reactive form per registered provider, prefilled from the
	 * tenant's existing credential (if any). The API key is required only
	 * on create — on update a blank value keeps the stored key.
	 */
	private buildForms(): void {
		this.forms = new Map(
			this.providers().map((provider) => {
				const credential = this.getCredential(provider.id);
				const knownModel = provider.models.some((model) => model.id === credential?.defaultModel);
				return [
					provider.id,
					this.fb.nonNullable.group<ProviderCredentialForm>({
						apiKey: this.fb.nonNullable.control('', credential ? [] : [Validators.required]),
						baseUrl: this.fb.nonNullable.control(credential?.baseUrl ?? '', [
							Validators.pattern(/^https?:\/\/.+/)
						]),
						defaultModel: this.fb.nonNullable.control(
							credential?.defaultModel ? (knownModel ? credential.defaultModel : CUSTOM_MODEL) : ''
						),
						customModel: this.fb.nonNullable.control(knownModel ? '' : credential?.defaultModel ?? ''),
						enabled: this.fb.nonNullable.control(credential?.enabled ?? true)
					})
				];
			})
		);

		const defaultCredential = [...this.credentialsByProvider.values()].find((credential) => credential.isDefault);
		this.defaultProviderControl.setValue(defaultCredential?.providerId ?? null, { emitEvent: false });
	}

	/**
	 * Shows an error toast including the backend's actual message (e.g. a
	 * misconfigured ENCRYPTION_KEY or a rejected Connect exchange) so
	 * failures are diagnosable instead of a generic "something went wrong".
	 */
	private showError(error: unknown): void {
		const serverMessage = this.extractErrorMessage(error);
		this.toastrService.danger(
			serverMessage || this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.ERROR'),
			this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.ERROR_TITLE'),
			{ duration: 8000 }
		);
	}

	private extractErrorMessage(error: any): string | null {
		const message = error?.error?.message ?? error?.message;
		if (Array.isArray(message)) return message.join('; ');
		if (typeof message === 'string' && message.trim()) {
			const status = error?.status ? ` (HTTP ${error.status})` : '';
			return `${message}${status}`;
		}
		return null;
	}
}

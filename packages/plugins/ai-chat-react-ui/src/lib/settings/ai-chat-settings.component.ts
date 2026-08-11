import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	DestroyRef,
	OnInit,
	inject,
	signal,
	computed
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbComponentStatus,
	NbDialogService,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbSpinnerModule,
	NbToastrService,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EMPTY, forkJoin, of } from 'rxjs';
import { catchError, filter, finalize, switchMap } from 'rxjs/operators';
import {
	IAiChatModel,
	IAiChatModelCatalogue,
	IAiChatProvider,
	IAiProviderCredential,
	IAiProviderCredentialCreateInput,
	IAiProviderCredentialUpdateInput
} from '@gauzy/contracts';
import { ChatSidebarService, Store } from '@gauzy/ui-core/core';
import { ConfirmComponent } from '@gauzy/ui-core/shared';
import { AiChatAvailabilityService } from '../ai-chat-availability.service';
import { AiChatSettingsService } from './ai-chat-settings.service';
import { IProviderLogo, PROVIDER_LOGOS } from './provider-logos';

/** Sentinel select value meaning "type a custom model id". */
const CUSTOM_MODEL = '__custom__';

/**
 * What the page tells the user about the chat itself, once they have (or
 * tried to) configure a provider. Each kind maps to one notice in
 * {@link CHAT_NOTICES}.
 */
type AiChatNoticeKind = 'ready' | 'no-permission' | 'globally-disabled' | 'credentials-unusable' | 'unreachable';

/** Presentation of each chat notice: Nebular status, icon and i18n keys. */
const CHAT_NOTICES: Record<AiChatNoticeKind, { status: NbComponentStatus; icon: string; title: string; hint: string }> =
	{
		ready: {
			status: 'success',
			icon: 'checkmark-circle-2-outline',
			title: 'AI_CHAT_UI.SETTINGS.STATUS.READY_TITLE',
			hint: 'AI_CHAT_UI.SETTINGS.STATUS.READY_HINT'
		},
		'no-permission': {
			status: 'warning',
			icon: 'lock-outline',
			title: 'AI_CHAT_UI.SETTINGS.STATUS.NO_PERMISSION_TITLE',
			hint: 'AI_CHAT_UI.SETTINGS.STATUS.NO_PERMISSION_HINT'
		},
		'globally-disabled': {
			status: 'warning',
			icon: 'slash-outline',
			title: 'AI_CHAT_UI.SETTINGS.STATUS.GLOBALLY_DISABLED_TITLE',
			hint: 'AI_CHAT_UI.SETTINGS.STATUS.GLOBALLY_DISABLED_HINT'
		},
		'credentials-unusable': {
			status: 'danger',
			icon: 'alert-triangle-outline',
			title: 'AI_CHAT_UI.SETTINGS.STATUS.CREDENTIALS_UNUSABLE_TITLE',
			hint: 'AI_CHAT_UI.SETTINGS.STATUS.CREDENTIALS_UNUSABLE_HINT'
		},
		unreachable: {
			status: 'info',
			icon: 'question-mark-circle-outline',
			title: 'AI_CHAT_UI.SETTINGS.STATUS.UNREACHABLE_TITLE',
			hint: 'AI_CHAT_UI.SETTINGS.STATUS.UNREACHABLE_HINT'
		}
	};

/** sessionStorage key holding the in-flight Connect (PKCE) state. */
const CONNECT_SESSION_KEY = 'gauzy_ai_provider_connect';

/** Typed shape of the per-provider credential form. */
interface ProviderCredentialForm {
	apiKey: FormControl<string>;
	baseUrl: FormControl<string>;
	/** Nullable: `null` is "no default model", which ng-select renders as its placeholder. */
	defaultModel: FormControl<string | null>;
	customModel: FormControl<string>;
	enabled: FormControl<boolean>;
}

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
		NbSpinnerModule,
		NbToggleModule,
		NbTooltipModule,
		// The model list runs to hundreds of entries on the routing providers, so the picker has to be
		// searchable — nb-select is not.
		NgSelectModule
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

	/**
	 * Live model catalogues, indexed by provider id, fetched when a provider's config view opens.
	 *
	 * Absent until then — {@link modelsFor} falls back to the curated list carried by `/config`, so
	 * the picker is never empty while this is loading or if it fails.
	 */
	private readonly modelCatalogues = signal<Map<string, IAiChatModelCatalogue>>(new Map());
	/**
	 * Provider ids whose catalogue is in flight.
	 *
	 * A SET, not one id. Switching from provider A to B before A returns had A's completion clear the
	 * single slot, dropping B's spinner while B was still loading — and leaving A's guard open, so
	 * going back to A fired a duplicate request.
	 */
	private readonly loadingModels = signal<ReadonlySet<string>>(new Set());
	/**
	 * Memoised picker items per provider, so `[items]` is referentially stable across change
	 * detection. Plain map, not a signal: it is a cache of a derived value, never a source of truth.
	 */
	private readonly modelOptionsCache = new Map<string, { source: IAiChatModel[]; options: IAiChatModel[] }>();
	/**
	 * Per-provider generation counter, bumped by {@link invalidateCatalogue}.
	 *
	 * Dropping the cached entry is not enough on its own: a fetch that was already in flight when the
	 * credential changed still resolves, and storing THAT answer re-caches the pre-change list — and
	 * the `has(providerId)` guard then blocks the refetch it was invalidated for. A response whose
	 * generation no longer matches is discarded instead.
	 */
	private readonly catalogueGeneration = new Map<string, number>();

	/** The provider object for the config view. */
	readonly selectedProvider = computed<IAiChatProvider | null>(
		() => this.providers().find((provider) => provider.id === this.selectedProviderId()) ?? null
	);

	/** Providers that are configured (tenant key or server env) — the list view rows. */
	readonly configuredProviders = computed<IAiChatProvider[]>(() =>
		this.providers().filter((provider) => provider.configured)
	);

	/**
	 * Tenant credentials indexed by provider id (API keys masked).
	 * A signal because {@link chatNotice} has to react to it: a saved-but-unusable
	 * credential is exactly the case the notice exists to explain.
	 */
	private readonly credentialsByProvider = signal<Map<string, IAiProviderCredential>>(new Map());
	/** Per-provider reactive forms indexed by provider id. */
	private forms = new Map<string, FormGroup<ProviderCredentialForm>>();
	/** Provider ids whose API key input is shown as plain text. */
	private revealedKeys = new Set<string>();

	/** Radio control: which provider is the tenant's default for chat. */
	readonly defaultProviderControl = new FormControl<string | null>(null);

	private readonly fb = inject(FormBuilder);
	private readonly store = inject(Store);
	private readonly availability = inject(AiChatAvailabilityService);
	private readonly chatSidebar = inject(ChatSidebarService);
	private readonly settingsService = inject(AiChatSettingsService);
	private readonly dialogService = inject(NbDialogService);
	private readonly toastrService = inject(NbToastrService);
	private readonly translateService = inject(TranslateService);
	private readonly cdr = inject(ChangeDetectorRef);
	private readonly router = inject(Router);
	private readonly route = inject(ActivatedRoute);
	// Angular's own teardown rather than @ngneat/until-destroy: that package is
	// not a dependency of this plugin, and takeUntilDestroyed does the same job.
	private readonly destroyRef = inject(DestroyRef);

	/**
	 * Which notice (if any) to show about the chat itself — the answer to
	 * "I configured a provider, so where is the chat?".
	 *
	 * Stays `null` while the page is loading, while the availability check is
	 * still pending, and for a brand-new tenant that has configured nothing yet
	 * (the empty state already tells that user what to do).
	 */
	readonly chatNotice = computed<AiChatNoticeKind | null>(() => {
		const status = this.availability.status();
		if (this.loading() || !status.resolved) {
			return null;
		}

		// Read the count off the SAME verdict that produced `status.reason`.
		// `AiChatAvailabilityService` and this component each call
		// `/api/ai-chat/config` on their own — and after save/delete/toggle both
		// `load()` and `refresh()` fire independently — so pairing this
		// component's `configuredProviders()` with the service's `reason` let the
		// notice combine two different snapshots (a fresh "no usable provider"
		// verdict with a stale count, say) and contradict the list below it.
		const configuredCount = status.configuredProviders;
		// The saved-credential rows have no counterpart on the verdict: the
		// service never calls `/credentials`, so this page is the only source for
		// "a credential row exists", not a second opinion on the same question.
		const credentialCount = this.credentialsByProvider().size;
		// `unreachable` is exempt from the "nothing configured yet, stay quiet"
		// gate below. In that state the service's call FAILED, so it reports
		// `configuredProviders: 0` meaning "unknown", not "none" — and a tenant
		// configured purely through server env has no credential rows either, so
		// the gate would swallow the one notice that explains why chat is missing.
		if (status.reason === 'unreachable') {
			return 'unreachable';
		}
		if (!configuredCount && !credentialCount) {
			return null;
		}

		if (status.available) {
			return 'ready';
		}

		switch (status.reason) {
			case 'no-permission':
				return 'no-permission';
			case 'globally-disabled':
				return 'globally-disabled';
			// No `unreachable` case: it is decided above the "nothing configured"
			// gate, so control flow has already narrowed it out of `reason` here.
			case 'no-providers':
				// A credential row exists but the server can use none of them: the
				// credential is disabled, or its stored key no longer decrypts
				// (ENCRYPTION_KEY changed). Without this the row silently vanishes
				// from the list and the page looks like nothing was ever saved.
				return configuredCount === 0 && credentialCount > 0 ? 'credentials-unusable' : null;
			default:
				return null;
		}
	});

	/** Presentation (status, icon, i18n keys) of the current chat notice. */
	readonly chatNoticeMeta = computed(() => {
		const kind = this.chatNotice();
		return kind ? CHAT_NOTICES[kind] : null;
	});

	ngOnInit(): void {
		// Complete an in-flight Connect flow when the provider redirected back
		// with ?code=... and we still hold the PKCE verifier for this session.
		const code = this.route.snapshot.queryParamMap.get('code');
		const pending = this.readConnectSession();
		if (code && pending) {
			// The exchange stores the key for the CURRENT tenant/organization, so
			// refuse to complete a flow that was started in a different workspace.
			// Compare exactly (null included): a flow started with no organization
			// must not complete under one selected mid-flight.
			const tenantChanged = (pending.tenantId ?? null) !== (this.store.user?.tenantId ?? null);
			const organizationChanged = (pending.organizationId ?? null) !== (this.store.organizationId ?? null);
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
		} else if (code) {
			// ?code= arrived but the PKCE session is gone (page reloaded, other
			// tab, or expired) — tell the user instead of failing silently, and
			// strip the stale one-time code from the URL.
			this.toastrService.warning(
				this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.CONNECT_SESSION_EXPIRED'),
				this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.ERROR_TITLE')
			);
			void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
			this.load();
		} else {
			this.load();
		}

		// The memoised picker items freeze the TRANSLATED "Custom model…" label, and neither of the
		// cache's other invalidations (a credential change, a new source array) fires on a language
		// switch — so without this the sentinel keeps rendering in the previous language.
		this.translateService.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
			this.modelOptionsCache.clear();
			this.cdr.markForCheck();
		});

		// Keep the view in sync with the query params (back/forward navigation).
		this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
			const providerId = params.get('provider');
			if (providerId) {
				this.selectedProviderId.set(providerId);
				this.view.set('config');
				// Only this view needs the catalogue, and only for this one provider.
				this.loadModels(providerId);
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
			.pipe(
				takeUntilDestroyed(this.destroyRef),
				finalize(() => this.loading.set(false))
			)
			.subscribe(({ config, credentials }) => {
				this.credentialsByProvider.set(
					new Map((credentials?.items ?? []).map((credential) => [credential.providerId, credential]))
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

	// ── Chat availability ──────────────────────────────────────────────

	/**
	 * Re-evaluates whether the chat is now available.
	 *
	 * Saving/deleting/connecting a credential flips the backend verdict but
	 * emits nothing the sidebar registration listens to, so without this call
	 * the chat only appears after a full page reload.
	 */
	private refreshChatAvailability(): void {
		this.availability.refresh();
	}

	/** Expands the chat sidebar, so "where is the chat?" is one click away. */
	openChat(): void {
		this.chatSidebar.expand();
	}

	// ── Template helpers ───────────────────────────────────────────────

	/**
	 * The brand mark bundled for a provider, or `null` when none is bundled.
	 *
	 * @param providerId Registered provider id, e.g. `openai`.
	 * @returns The mark to draw in the provider's tile, `null` to fall back to
	 * the monogram tile (see {@link tileMonogram}).
	 */
	providerLogo(providerId: string): IProviderLogo | null {
		// Own-property lookup rather than a bare index: provider ids come from
		// the backend, and an id such as "constructor" would otherwise resolve
		// to something off `Object.prototype` and blow up the tile.
		return Object.hasOwn(PROVIDER_LOGOS, providerId) ? PROVIDER_LOGOS[providerId] : null;
	}

	/**
	 * Initials for the fallback monogram tile, drawn only for providers that
	 * ship no brand mark — a provider contributed by a future plugin, say.
	 * Rendering initials keeps that tile from collapsing into an empty box.
	 *
	 * @param provider The provider to label.
	 * @returns Up to two uppercase initials, one per leading word of the label
	 * (so "Vercel AI Gateway" reads "VA", not "VE").
	 */
	tileMonogram(provider: IAiChatProvider): string {
		// Everything here comes off the wire, so nothing is assumed present: a
		// provider that somehow arrives without a label AND without an id must
		// still render a tile rather than throw and blank the whole page.
		const id = provider?.id ?? '';
		const words = (provider?.label || id)
			.trim()
			.split(/[\s_-]+/)
			.filter(Boolean);
		const initials = words
			.slice(0, 2)
			.map((word) => word.charAt(0))
			.join('');
		return (initials || id.slice(0, 2) || '?').toUpperCase();
	}

	// ── Model catalogue (config view) ──────────────────────────────────

	/**
	 * Fetches a provider's model catalogue for the picker.
	 *
	 * Fails soft in both directions: an error leaves the curated list in place (the endpoint itself
	 * already degrades to curated rather than erroring, so this only catches transport failures), and
	 * a second visit to the same provider re-uses what was already fetched instead of re-calling an
	 * upstream API on every back-and-forth between the list and the config view.
	 */
	loadModels(providerId: string): void {
		if (this.modelCatalogues().has(providerId) || this.loadingModels().has(providerId)) {
			return;
		}
		const generation = this.catalogueGeneration.get(providerId) ?? 0;
		this.loadingModels.update((current) => new Set(current).add(providerId));
		this.settingsService
			.getProviderModels(providerId)
			.pipe(
				takeUntilDestroyed(this.destroyRef),
				catchError(() => of(null)),
				finalize(() => {
					this.loadingModels.update((current) => {
						const next = new Set(current);
						next.delete(providerId);
						return next;
					});
					this.cdr.markForCheck();
				})
			)
			.subscribe((catalogue) => {
				// A credential changed while this was in flight, so this answer is about a key that is
				// no longer configured. Dropping it leaves the map empty, which is what makes the next
				// visit fetch again.
				if (!catalogue || (this.catalogueGeneration.get(providerId) ?? 0) !== generation) {
					return;
				}
				this.modelCatalogues.update((current) => new Map(current).set(providerId, catalogue));
				this.reconcileModelSelection(providerId);
				this.cdr.markForCheck();
			});
	}

	/** Whether this provider's catalogue is being fetched right now. */
	isLoadingModels(providerId: string): boolean {
		return this.loadingModels().has(providerId);
	}

	/**
	 * Forget a provider's cached catalogue, so the next visit re-fetches it.
	 *
	 * Called whenever the CREDENTIAL changes, because the catalogue depends on it. Without this, the
	 * flow the whole feature exists to fix reappears one step later: a provider running on the shared
	 * free key shows the free-tier list, the user saves their own key in that very form, and on
	 * returning they are still offered the four free models — the cached answer to a question that no
	 * longer applies.
	 */
	private invalidateCatalogue(providerId: string): void {
		this.catalogueGeneration.set(providerId, (this.catalogueGeneration.get(providerId) ?? 0) + 1);
		this.modelOptionsCache.delete(providerId);
		this.modelCatalogues.update((current) => {
			if (!current.has(providerId)) {
				return current;
			}
			const next = new Map(current);
			next.delete(providerId);
			return next;
		});
	}

	/**
	 * The models to offer for a provider: the fetched catalogue when there is one, else the curated
	 * list that came with `/config`.
	 */
	modelsFor(provider: IAiChatProvider): IAiChatModel[] {
		const catalogue = this.modelCatalogues().get(provider.id);
		return catalogue?.models.length ? catalogue.models : provider.models;
	}

	/**
	 * Picker items: the models plus the "Custom model…" sentinel.
	 *
	 * The sentinel stays even with a live catalogue. Providers ship models faster than any catalogue
	 * endpoint reflects them, and a paid model can be addressable by a key long before it is listed —
	 * so there has to be a way to type an id in by hand.
	 */
	modelOptions(provider: IAiChatProvider): IAiChatModel[] {
		// Memoised per (provider, source list). The template binds this into ng-select's `[items]`, and
		// a fresh array on every change-detection pass makes ng-select rebuild its ItemsList each time
		// — which resets the keyboard-marked item, so arrow keys could not move through the list at
		// all. Keyed on the array identity rather than deep equality: `modelsFor` returns either the
		// catalogue's array or the provider's, both of which are stable until they are replaced.
		const models = this.modelsFor(provider);
		const cached = this.modelOptionsCache.get(provider.id);
		if (cached && cached.source === models) {
			return cached.options;
		}
		const options = [
			...models,
			{
				id: CUSTOM_MODEL,
				label: this.translateService.instant('AI_CHAT_UI.SETTINGS.FORM.DEFAULT_MODEL_CUSTOM'),
				providerId: provider.id
			}
		];
		this.modelOptionsCache.set(provider.id, { source: models, options });
		return options;
	}

	/**
	 * Search a model by its ID as well as its label.
	 *
	 * ng-select's default search only looks at the label, and on the routing providers the label is a
	 * display name ("Anthropic: Claude Sonnet 5") while the id is the slug
	 * (`anthropic/claude-sonnet-5`). Pasting the id you were handed — the thing the empty-state text
	 * tells you to type — matched nothing and reported the model as absent while it sat in the list.
	 */
	readonly searchModel = (term: string, model: IAiChatModel): boolean => {
		// "Custom model…" always survives. It is the escape hatch for a model that is NOT in the list,
		// so filtering it out on a search that matches nothing leaves the not-found text telling the
		// user to pick an option that is no longer on screen.
		if (model.id === CUSTOM_MODEL) {
			return true;
		}
		const needle = term.toLowerCase();
		return model.id.toLowerCase().includes(needle) || (model.label ?? '').toLowerCase().includes(needle);
	};

	/**
	 * The note under the model picker explaining where its list came from, or `null` when the list is
	 * live and complete (the ordinary case needs no explanation).
	 */
	modelSourceKey(provider: IAiChatProvider): string | null {
		// Before anything catalogue-shaped: a placeholder provider (chat routing not implemented; its
		// catalogue is deliberately empty) must not fall through to the 'curated' advice below, which
		// tells the user to save an API key — the one remedy that cannot help here. Checked first and
		// independent of the fetch, because the provider is a placeholder whether or not the catalogue
		// has arrived.
		if (provider.chatCapable === false) {
			return 'AI_CHAT_UI.SETTINGS.FORM.MODELS_NOT_CHAT_CAPABLE';
		}
		const catalogue = this.modelCatalogues().get(provider.id);
		if (!catalogue) {
			return null;
		}
		if (catalogue.source === 'platform') {
			// An EMPTY platform list is not "limited to the free models" — it means the free list could
			// not be determined, and the server will refuse every model until it can. Saying the former
			// in front of an empty dropdown reads as a UI bug.
			return catalogue.models.length
				? 'AI_CHAT_UI.SETTINGS.FORM.MODELS_PLATFORM'
				: 'AI_CHAT_UI.SETTINGS.FORM.MODELS_PLATFORM_UNAVAILABLE';
		}
		if (catalogue.source === 'curated') {
			// A custom base URL means the server DELIBERATELY made no request: the key belongs to that
			// endpoint, not to the vendor. Reporting that as "could not be loaded just now" invites a
			// retry for a fetch that was never attempted and never will be.
			if (this.getCredential(provider.id)?.baseUrl) {
				return 'AI_CHAT_UI.SETTINGS.FORM.MODELS_CUSTOM_ENDPOINT';
			}
			// The remaining two situations need opposite advice. Telling a user whose key IS saved to
			// "save an API key" reads as the page not knowing what it is doing.
			return provider.configured
				? 'AI_CHAT_UI.SETTINGS.FORM.MODELS_CURATED_UNAVAILABLE'
				: 'AI_CHAT_UI.SETTINGS.FORM.MODELS_CURATED_NO_KEY';
		}
		return catalogue.stale ? 'AI_CHAT_UI.SETTINGS.FORM.MODELS_STALE' : null;
	}

	/**
	 * Re-decides "known model vs custom" once the catalogue arrives.
	 *
	 * {@link buildForms} runs before the fetch and can only compare against the curated list, so a
	 * saved model that is real but simply not curated starts out shown as a custom id. Left alone it
	 * would stay that way — a text box next to a dropdown that in fact contains the very model.
	 */
	private reconcileModelSelection(providerId: string): void {
		const form = this.forms.get(providerId);
		if (!form || form.controls.defaultModel.value !== CUSTOM_MODEL) {
			return;
		}
		const typed = form.controls.customModel.value?.trim();
		if (!typed) {
			return;
		}
		const known = this.modelCatalogues()
			.get(providerId)
			?.models.some((model) => model.id === typed);
		if (known) {
			form.patchValue({ defaultModel: typed, customModel: '' }, { emitEvent: false });
		}
	}

	/** Returns the credential form for a provider. */
	getForm(providerId: string): FormGroup<ProviderCredentialForm> {
		return this.forms.get(providerId);
	}

	/** Returns the tenant credential (masked) for a provider, if any. */
	getCredential(providerId: string): IAiProviderCredential | undefined {
		return this.credentialsByProvider().get(providerId);
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

	/**
	 * Returns the translation key for a provider's configuration badge.
	 *
	 * Every credential source needs its OWN badge. This used to branch on 'environment' and fall
	 * through to TENANT_KEY, which meant a tenant running on the shared platform key was told it had
	 * entered its own — the one message that is both false and the opposite of the nudge we want,
	 * since bringing your own key is exactly how you escape the shared rate limit.
	 */
	getBadgeKey(provider: IAiChatProvider): string {
		if (!provider.configured) {
			return 'AI_CHAT_UI.SETTINGS.BADGE.NOT_CONFIGURED';
		}
		switch (provider.credentialSource) {
			case 'environment':
				return 'AI_CHAT_UI.SETTINGS.BADGE.SERVER_ENV';
			case 'platform':
				return 'AI_CHAT_UI.SETTINGS.BADGE.PLATFORM_FREE';
			default:
				return 'AI_CHAT_UI.SETTINGS.BADGE.TENANT_KEY';
		}
	}

	/** Returns the badge status color for a provider's configuration state. */
	getBadgeStatus(provider: IAiChatProvider): string {
		if (!provider.configured) {
			return 'basic';
		}
		switch (provider.credentialSource) {
			case 'environment':
				return 'info';
			// Working, but not the end state we want the user to sit on: it is rate limited and
			// shared. 'warning' reads as "usable, with a caveat" rather than "all set".
			case 'platform':
				return 'warning';
			default:
				return 'success';
		}
	}

	/** True when this provider is running on the shared, product-supplied free key. */
	isOnPlatformKey(provider: IAiChatProvider): boolean {
		return provider.configured && provider.credentialSource === 'platform';
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
			.pipe(
				takeUntilDestroyed(this.destroyRef),
				finalize(() => this.saving.set(null))
			)
			.subscribe({
				next: () => {
					// Disabling a tenant key can hand the provider back to the shared platform key, which
					// has a different (narrower) model list.
					this.invalidateCatalogue(provider.id);
					this.load();
					// Disabling the last enabled credential takes the chat away —
					// and enabling one brings it back. Both must be reflected now.
					this.refreshChatAvailability();
				},
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
				takeUntilDestroyed(this.destroyRef),
				// ONLY the spinner is reset here. `finalize` runs on ANY termination —
				// including the completion `takeUntilDestroyed` injects when the component
				// is destroyed — so the URL cleanup must NOT live in it: a relative
				// `router.navigate()` issued from a destroyed component still resolves
				// against its populated route snapshot, which would drag the user back
				// to /pages/settings/ai from whatever settings page they moved on to.
				// `next`/`error` are the handlers that are genuinely skipped after
				// teardown, so the navigation lives there instead.
				finalize(() => this.connecting.set(false))
			)
			.subscribe({
				next: () => {
					this.toastrService.success(
						this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.CONNECTED', {
							provider: this.providerLabel(providerId)
						}),
						this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.SUCCESS_TITLE')
					);
					this.finishConnect();
				},
				error: (error) => {
					this.showError(error);
					this.finishConnect();
				}
			});
	}

	/**
	 * Strips the one-time `?code=...` from the URL and reloads the page data
	 * after a Connect exchange settled (either way).
	 */
	private finishConnect(): void {
		void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
		// Connect writes a tenant key, so the catalogue it replaces is now wrong. Unconditional
		// because this also runs on the failure path, where re-fetching costs one call and being
		// wrong costs the user their full model list.
		const pending = this.selectedProviderId();
		if (pending) {
			this.invalidateCatalogue(pending);
		}
		this.load();
		// A successful Connect changes the chat's verdict, so the gate has to be
		// re-evaluated or the chat stays hidden until a full reload.
		this.refreshChatAvailability();
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
		request$
			.pipe(
				takeUntilDestroyed(this.destroyRef),
				finalize(() => this.saving.set(null))
			)
			.subscribe({
				next: () => {
					this.toastrService.success(
						this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.SAVED', { provider: provider.label }),
						this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.SUCCESS_TITLE')
					);
					// The saved key IS the catalogue's input — a tenant key that just replaced the shared
					// free one unlocks the provider's full list.
					this.invalidateCatalogue(provider.id);
					this.load();
					// The very first provider turns the chat on — the list view the
					// user lands on must already say so.
					this.refreshChatAvailability();
					// Navigates: without the `takeUntilDestroyed(this.destroyRef)` above, a save that
					// resolves after the user left would yank them back to this page.
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
				}),
				takeUntilDestroyed(this.destroyRef)
			)
			.subscribe(() => {
				this.toastrService.success(
					this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.DELETED', { provider: provider.label }),
					this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.SUCCESS_TITLE')
				);
				// Removing the tenant key drops the provider back to whatever resolves next. Delete does
				// not navigate away, so nothing else would re-fetch: without this the config view keeps
				// showing the curated fallback, with no hint, looking like a complete live list.
				this.invalidateCatalogue(provider.id);
				if (this.view() === 'config' && this.selectedProviderId() === provider.id) {
					this.loadModels(provider.id);
				}
				this.load();
				// Deleting the last credential takes the chat away again.
				this.refreshChatAvailability();
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
				// Against the catalogue when one has already been fetched, so a save-and-return does
				// not demote a perfectly ordinary model back to "custom".
				const knownModel = this.modelsFor(provider).some((model) => model.id === credential?.defaultModel);
				return [
					provider.id,
					this.fb.nonNullable.group<ProviderCredentialForm>({
						apiKey: this.fb.nonNullable.control('', credential ? [] : [Validators.required]),
						baseUrl: this.fb.nonNullable.control(credential?.baseUrl ?? '', [
							Validators.pattern(/^https?:\/\/.+/)
						]),
						// `null`, not `''`. ng-select accepts '' as a real value in single-select mode and
						// fabricates a selected item for it, so the "Provider default" placeholder never
						// rendered and the field sat blank with a clear (x) button on it.
						defaultModel: this.fb.control<string | null>(
							credential?.defaultModel ? (knownModel ? credential.defaultModel : CUSTOM_MODEL) : null
						),
						customModel: this.fb.nonNullable.control(knownModel ? '' : (credential?.defaultModel ?? '')),
						enabled: this.fb.nonNullable.control(credential?.enabled ?? true)
					})
				];
			})
		);

		const defaultCredential = [...this.credentialsByProvider().values()].find((credential) => credential.isDefault);
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

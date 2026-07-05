import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
	NbBadgeModule,
	NbButtonModule,
	NbCardModule,
	NbDialogService,
	NbFormFieldModule,
	NbIconModule,
	NbInputModule,
	NbRadioModule,
	NbSelectModule,
	NbSpinnerModule,
	NbToastrService,
	NbToggleModule,
	NbTooltipModule
} from '@nebular/theme';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EMPTY, forkJoin } from 'rxjs';
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

/** Typed shape of the per-provider credential form. */
interface ProviderCredentialForm {
	apiKey: FormControl<string>;
	baseUrl: FormControl<string>;
	defaultModel: FormControl<string>;
	customModel: FormControl<string>;
	enabled: FormControl<boolean>;
}

/**
 * AiChatSettingsComponent
 *
 * Per-tenant "AI Providers" (BYOK — bring your own key) settings page.
 *
 * Lists every provider registered on the backend (`GET /api/ai-chat/config`)
 * as a card showing its configuration status (tenant key / server env / not
 * configured) and models, with a form to add, update or delete the tenant's
 * API credential for that provider. Exactly one provider can be marked as
 * the tenant default (radio across cards).
 *
 * Requires the `AI_CHAT_SETTINGS` permission (enforced by the route guard
 * and by the backend controller).
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
		NbRadioModule,
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
	/** Providers registered on the backend. */
	readonly providers = signal<IAiChatProvider[]>([]);

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

	ngOnInit(): void {
		this.load();
	}

	/**
	 * Loads the provider configuration and tenant credentials, then
	 * (re)builds one credential form per registered provider.
	 */
	load(): void {
		this.loading.set(true);
		forkJoin({
			config: this.settingsService.getConfig(),
			credentials: this.settingsService.getCredentials()
		})
			.pipe(finalize(() => this.loading.set(false)))
			.subscribe({
				next: ({ config, credentials }) => {
					this.credentialsByProvider = new Map(
						(credentials?.items ?? []).map((credential) => [credential.providerId, credential])
					);
					this.providers.set(config?.providers ?? []);
					this.buildForms();
					this.cdr.markForCheck();
				},
				error: () => this.showError()
			});
	}

	/**
	 * Returns the credential form for a provider.
	 *
	 * @param providerId - The provider id.
	 */
	getForm(providerId: string): FormGroup<ProviderCredentialForm> {
		return this.forms.get(providerId);
	}

	/**
	 * Returns the tenant credential (masked) for a provider, if any.
	 *
	 * @param providerId - The provider id.
	 */
	getCredential(providerId: string): IAiProviderCredential | undefined {
		return this.credentialsByProvider.get(providerId);
	}

	/**
	 * Whether the API key input of a provider is shown as plain text.
	 *
	 * @param providerId - The provider id.
	 */
	isKeyRevealed(providerId: string): boolean {
		return this.revealedKeys.has(providerId);
	}

	/**
	 * Toggles the API key input of a provider between password and plain text.
	 *
	 * @param providerId - The provider id.
	 */
	toggleKeyReveal(providerId: string): void {
		if (!this.revealedKeys.delete(providerId)) {
			this.revealedKeys.add(providerId);
		}
	}

	/**
	 * Returns the translation key for a provider's configuration badge.
	 *
	 * @param provider - The provider.
	 */
	getBadgeKey(provider: IAiChatProvider): string {
		if (!provider.configured) {
			return 'AI_CHAT_UI.SETTINGS.BADGE.NOT_CONFIGURED';
		}
		return provider.credentialSource === 'environment'
			? 'AI_CHAT_UI.SETTINGS.BADGE.SERVER_ENV'
			: 'AI_CHAT_UI.SETTINGS.BADGE.TENANT_KEY';
	}

	/**
	 * Returns the badge status color for a provider's configuration state.
	 *
	 * @param provider - The provider.
	 */
	getBadgeStatus(provider: IAiChatProvider): string {
		if (!provider.configured) {
			return 'basic';
		}
		return provider.credentialSource === 'environment' ? 'info' : 'success';
	}

	/**
	 * Saves the credential of a provider: `POST` (upsert) when the tenant has
	 * no credential yet, `PUT` when one exists. A blank API key on update
	 * keeps the stored key.
	 *
	 * @param provider - The provider whose form should be persisted.
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
			},
			error: () => this.showError()
		});
	}

	/**
	 * Deletes the tenant credential of a provider after confirmation.
	 *
	 * @param provider - The provider whose credential should be removed.
	 */
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
						catchError(() => {
							this.showError();
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

	/** Shows a generic error toast. */
	private showError(): void {
		this.toastrService.danger(
			this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.ERROR'),
			this.translateService.instant('AI_CHAT_UI.SETTINGS.TOASTR.ERROR_TITLE')
		);
	}
}

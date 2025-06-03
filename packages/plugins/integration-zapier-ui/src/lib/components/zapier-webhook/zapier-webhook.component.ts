import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { tap, catchError, takeUntil } from 'rxjs/operators';
import { EMPTY, Subject } from 'rxjs';
import { ZapierService, ZapierStoreService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IZapierWebhook, IZapierCreateWebhookInput } from '@gauzy/contracts';

@Component({
	selector: 'ngx-zapier-webhook',
	templateUrl: './zapier-webhook.component.html',
	styleUrls: ['./zapier-webhook.component.scss'],
	standalone: false
})
export class ZapierWebhookComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public form: FormGroup;
	public loading = false;
	public webhooks: IZapierWebhook[] = [];
	private readonly destroy$ = new Subject<void>();
	private token: string;

	constructor(
		private readonly _fb: FormBuilder,
		private readonly _zapierService: ZapierService,
		private readonly _zapierStoreService: ZapierStoreService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this._loadWebhooks();
		this._subscribeToStore();
	}

	ngOnDestroy() {
		this.destroy$.next();
		this.destroy$.complete();
	}

	private _initializeForm() {
		this.form = this._fb.group({
			event: ['', Validators.required],
			target_url: ['', [Validators.required, Validators.pattern('https?://.+')]]
		});
	}

	private _subscribeToStore() {
		// Subscribe to webhooks from store
		this._zapierStoreService.webhooks$.pipe(takeUntil(this.destroy$)).subscribe((webhooks) => {
			this.webhooks = webhooks;
		});

		// Subscribe to loading state
		this._zapierStoreService.isWebhookLoading$.pipe(takeUntil(this.destroy$)).subscribe((loading) => {
			this.loading = loading;
		});
	}

	private _loadWebhooks() {
		if (!this.token) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.NO_TOKEN'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		this._zapierStoreService.setWebhookLoading(true);
		this._zapierService
			.getWebhooks(this.token)
			.pipe(
				tap((webhooks: IZapierWebhook[]) => {
					this._zapierStoreService.setWebhooks(webhooks);
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.LOAD_WEBHOOKS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading Zapier webhooks:', error);
					return EMPTY;
				})
			)
			.subscribe(() => {
				this._zapierStoreService.setWebhookLoading(false);
			});
	}

	/**
	 * Create a new webhook
	 */
	createWebhook() {
		if (this.form.invalid) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.INVALID_FORM'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		if (!this.token) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.NO_TOKEN'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		const webhookInput: IZapierCreateWebhookInput = {
			target_url: this.form.get('target_url').value,
			event: this.form.get('event').value
		};

		this._zapierStoreService.setWebhookLoading(true);
		this._zapierService
			.createWebhook(webhookInput, this.token)
			.pipe(
				tap((webhook: IZapierWebhook) => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.ZAPIER.SUCCESS.WEBHOOK_CREATED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					this.form.reset();
					this._zapierStoreService.addWebhook(webhook);
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.CREATE_WEBHOOK'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error creating Zapier webhook:', error);
					return EMPTY;
				})
			)
			.subscribe(() => {
				this._zapierStoreService.setWebhookLoading(false);
			});
	}

	/**
	 * Delete a webhook
	 */
	deleteWebhook(webhookId: string) {
		if (!this.token) {
			this._toastrService.error(
				this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.NO_TOKEN'),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
			return;
		}

		this._zapierStoreService.setWebhookLoading(true);
		this._zapierService
			.deleteWebhook(webhookId, this.token)
			.pipe(
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.ZAPIER.SUCCESS.WEBHOOK_DELETED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					this._zapierStoreService.removeWebhook(webhookId);
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.DELETE_WEBHOOK'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error deleting Zapier webhook:', error);
					return EMPTY;
				})
			)
			.subscribe(() => {
				this._zapierStoreService.setWebhookLoading(false);
			});
	}

	/**
	 * Set the authentication token
	 */
	setToken(token: string) {
		this.token = token;
		this._loadWebhooks();
	}
}

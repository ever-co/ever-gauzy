import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { tap, catchError } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ZapierStoreService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IZapierWebhook } from '@gauzy/contracts';

@Component({
	selector: 'ngx-zapier-webhook',
	templateUrl: './zapier-webhook.component.html',
	styleUrls: ['./zapier-webhook.component.scss']
})
export class ZapierWebhookComponent extends TranslationBaseComponent implements OnInit {
	public form: FormGroup;
	public loading = false;
	public webhooks: IZapierWebhook[] = [];

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
	}

	private _initializeForm() {
		this.form = this._fb.group({
			event: ['', Validators.required],
			targetUrl: ['', [Validators.required, Validators.pattern('https?://.+')]]
		});
	}

	private _loadWebhooks() {
		this.loading = true;
		this._zapierService
			.getWebhooks()
			.pipe(
				tap((webhooks: IZapierWebhook[]) => {
					this.webhooks = webhooks;
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
				this.loading = false;
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

		this.loading = true;
		this._zapierService
			.createWebhook(this.form.value)
			.pipe(
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.ZAPIER.SUCCESS.WEBHOOK_CREATED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					this.form.reset();
					this._loadWebhooks();
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
				this.loading = false;
			});
	}

	/**
	 * Delete a webhook
	 */
	deleteWebhook(webhookId: string) {
		this.loading = true;
		this._zapierService
			.deleteWebhook(webhookId)
			.pipe(
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.ZAPIER.SUCCESS.WEBHOOK_DELETED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					this._loadWebhooks();
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
				this.loading = false;
			});
	}
}

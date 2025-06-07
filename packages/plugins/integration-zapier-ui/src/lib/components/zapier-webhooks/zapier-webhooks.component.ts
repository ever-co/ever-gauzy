import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { tap, catchError, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IZapierWebhook } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-zapier-webhooks',
	templateUrl: './zapier-webhooks.component.html',
	standalone: false
})
export class ZapierWebhooksComponent extends TranslationBaseComponent implements OnInit {
	public webhooks: IZapierWebhook[] = [];
	public loading = false;

	constructor(
		private readonly _route: ActivatedRoute,
		private readonly _zapierService: ZapierService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._loadWebhooks();
	}

	private _loadWebhooks() {
		this.loading = true;
		const integrationId = this._route.snapshot.params['id'];

		this._zapierService
			.getWebhooks(integrationId)
			.pipe(
				tap((webhooks: IZapierWebhook[]) => {
					this.webhooks = webhooks;
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.LOAD_WEBHOOKS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading Zapier webhooks:', error);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Delete webhook
	 */
	deleteWebhook(webhook: IZapierWebhook) {
		const integrationId = this._route.snapshot.params['id'];

		this._zapierService
			.deleteWebhook(webhook.id, integrationId)
			.pipe(
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.SUCCESS.WEBHOOK_DELETED'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					this._loadWebhooks();
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.DELETE_WEBHOOK'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error deleting Zapier webhook:', error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}

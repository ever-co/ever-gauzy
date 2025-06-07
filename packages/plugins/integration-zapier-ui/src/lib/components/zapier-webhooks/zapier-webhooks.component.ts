import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { tap, catchError, finalize, switchMap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IZapierWebhook, IZapierAccessTokens, IZapierAuthConfig } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-zapier-webhooks',
	templateUrl: './zapier-webhooks.component.html',
	styleUrls: ['./zapier-webhooks.component.scss'],
	standalone: false
})
export class ZapierWebhooksComponent extends TranslationBaseComponent implements OnInit {
	public loading = false;
	public webhooks: IZapierWebhook[] = [];

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
			.getOAuthConfig()
			.pipe(
				switchMap((config: IZapierAuthConfig) => {
					if (!config.clientId || !config.clientSecret) {
						throw new Error('Missing client credentials');
					}
					return this._zapierService.exchangeCodeForToken({
						client_id: config.clientId,
						client_secret: config.clientSecret,
						redirect_uri: config.redirectUri,
						grant_type: 'authorization_code'
					});
				}),
				switchMap((tokens: IZapierAccessTokens) => {
					if (tokens && tokens.access_token) {
						return this._zapierService.getWebhooks(tokens.access_token);
					}
					throw new Error('No access token available');
				}),
				tap((webhooks: IZapierWebhook[]) => {
					this.webhooks = webhooks;
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.LOAD_WEBHOOKS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading webhooks:', error);
					return EMPTY;
				}),
				finalize(() => {
					this.loading = false;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	deleteWebhook(webhookId: string) {
		const integrationId = this._route.snapshot.params['id'];

		this._zapierService
			.getOAuthConfig()
			.pipe(
				switchMap((config: IZapierAuthConfig) => {
					if (!config.clientId || !config.clientSecret) {
						throw new Error('Missing client credentials');
					}
					return this._zapierService.exchangeCodeForToken({
						code: integrationId,
						client_id: config.clientId,
						client_secret: config.clientSecret,
						redirect_uri: config.redirectUri,
						grant_type: 'authorization_code'
					});
				}),
				switchMap((tokens: IZapierAccessTokens) => {
					if (tokens && tokens.access_token) {
						return this._zapierService.deleteWebhook(webhookId, tokens.access_token);
					}
					throw new Error('No access token available');
				}),
				tap(() => {
					this._toastrService.success(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.SUCCESS.DELETE_WEBHOOK'),
						this.getTranslation('TOASTR.TITLE.SUCCESS')
					);
					this._loadWebhooks();
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.DELETE_WEBHOOK'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error deleting webhook:', error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}

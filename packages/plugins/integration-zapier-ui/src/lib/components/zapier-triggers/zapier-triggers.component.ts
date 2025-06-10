import { Component, OnInit } from '@angular/core';
import { tap, catchError, finalize, switchMap } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IZapierEndpoint, IZapierOAuthTokenDTO, IZapierAuthConfig } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-zapier-triggers',
	templateUrl: './zapier-triggers.component.html',
	styleUrls: ['./zapier-triggers.component.scss'],
	standalone: false
})
export class ZapierTriggersComponent extends TranslationBaseComponent implements OnInit {
	public loading = false;
	public triggers: IZapierEndpoint[] = [];

	constructor(
		private readonly _zapierService: ZapierService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._loadTriggers();
	}

	private _loadTriggers() {
		this.loading = true;

		this._zapierService
			.getOAuthConfig()
			.pipe(
				switchMap((config: IZapierAuthConfig) => {
					if (!config.clientId || !config.clientSecret) {
						throw new Error('Missing client credentials');
					}
					return this._zapierService.exchangeCodeForToken({
						code: 'code',
						client_id: config.clientId,
						client_secret: config.clientSecret,
						redirect_uri: config.redirectUri,
						grant_type: 'refresh_token'
					});
				}),
				switchMap((tokens: IZapierOAuthTokenDTO) => {
					if (tokens?.access_token) {
						return this._zapierService.getTriggers(tokens.access_token);
					}
					throw new Error('No access token available');
				}),
				tap((triggers: IZapierEndpoint[]) => {
					this.triggers = triggers;
				}),
				catchError(() => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.LOAD_TRIGGERS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
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
	 * Open trigger details
	 */
	openTriggerDetails(trigger: IZapierEndpoint) {
		// TODO: Implement trigger details view
	}
}

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
	selector: 'ngx-zapier-actions',
	templateUrl: './zapier-actions.component.html',
	styleUrls: ['./zapier-actions.component.scss'],
	standalone: false
})
export class ZapierActionsComponent extends TranslationBaseComponent implements OnInit {
	public loading = false;
	public actions: IZapierEndpoint[] = [];

	constructor(
		private readonly _zapierService: ZapierService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._loadActions();
	}

	private _loadActions() {
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
					if (tokens && tokens.access_token) {
						return this._zapierService.getActions(tokens.access_token);
					}
					throw new Error('No access token available');
				}),
				tap((actions: IZapierEndpoint[]) => {
					this.actions = actions;
				}),
				catchError(() => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.LOAD_ACTIONS'),
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
	 * Open action details
	 */
	openActionDetails() {
		// TODO: Implement action details view
	}
}

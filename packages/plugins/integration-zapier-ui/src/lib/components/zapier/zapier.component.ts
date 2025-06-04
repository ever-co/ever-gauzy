import { Component, OnInit } from '@angular/core';
import { tap, catchError } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ZapierStoreService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IZapierEndpoint, IZapierAuthConfig } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-zapier',
	templateUrl: './zapier.component.html',
	styleUrls: ['./zapier.component.scss'],
	standalone: false
})
export class ZapierComponent extends TranslationBaseComponent implements OnInit {
	private token: string;

	constructor(
		private readonly _zapierService: ZapierService,
		public readonly zapierStoreService: ZapierStoreService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._loadSettings();
	}

	private _loadSettings() {
		this._zapierService.getSettings().subscribe(
			(settings) => {
				if (settings && settings.isEnabled) {
					// Get OAuth configuration first
					this._zapierService.getOAuthConfig().subscribe(
						(config: IZapierAuthConfig) => {
							// Initialize the integration with OAuth config
							this._zapierService
								.initializeIntegration({
									client_id: config.clientId,
									client_secret: config.clientSecret,
									redirect_uri: config.redirectUri
								})
								.subscribe(
									(response) => {
										// Redirect to Zapier authorization URL
										window.location.href = response.authorizationUrl;
									},
									(error) => {
										this._toastrService.error(
											this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.INITIALIZATION'),
											this.getTranslation('TOASTR.TITLE.ERROR')
										);
										console.error('Error initializing Zapier integration:', error);
									}
								);
						},
						(error) => {
							this._toastrService.error(
								this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.LOAD_CONFIG'),
								this.getTranslation('TOASTR.TITLE.ERROR')
							);
							console.error('Error loading Zapier OAuth config:', error);
						}
					);
				} else {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.NOT_ENABLED'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
				}
			},
			(error) => {
				this._toastrService.error(
					this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.LOAD_SETTINGS'),
					this.getTranslation('TOASTR.TITLE.ERROR')
				);
				console.error('Error loading Zapier settings:', error);
			},
			untilDestroyed(this)
		);
	}

	/**
	 * Handle the OAuth callback with the authorization code
	 */
	handleAuthCallback(code: string) {
		this._zapierService
			.getOAuthConfig()
			.pipe(untilDestroyed(this))
			.subscribe(
				(config: IZapierAuthConfig) => {
					this._zapierService
						.exchangeCodeForToken({
							code: code,
							client_id: config.clientId,
							client_secret: config.clientSecret,
							redirect_uri: config.redirectUri,
							grant_type: 'authorization_code'
						})
						.pipe(untilDestroyed(this))
						.subscribe(
							(tokens) => {
								this.token = tokens.access_token;
								this._loadTriggers();
								this._loadActions();
							},
							(error) => {
								this._toastrService.error(
									this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.TOKEN_EXCHANGE'),
									this.getTranslation('TOASTR.TITLE.ERROR')
								);
								console.error('Error exchanging code for token:', error);
							}
						);
				},
				(error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.LOAD_CONFIG'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading Zapier OAuth config:', error);
				}
			);
	}

	private _loadTriggers() {
		if (!this.token) return;

		this.zapierStoreService.setLoading(true);
		this._zapierService
			.getTriggers(this.token)
			.pipe(
				tap((triggers: IZapierEndpoint[]) => {
					this.zapierStoreService.setTriggers(triggers);
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.LOAD_TRIGGERS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading Zapier triggers:', error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.zapierStoreService.setLoading(false);
			});
	}

	private _loadActions() {
		if (!this.token) return;

		this.zapierStoreService.setLoading(true);
		this._zapierService
			.getActions(this.token)
			.pipe(
				tap((actions: IZapierEndpoint[]) => {
					this.zapierStoreService.setActions(actions);
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.LOAD_ACTIONS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading Zapier actions:', error);
					return EMPTY;
				}),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.zapierStoreService.setLoading(false);
			});
	}

	openEndpointDetails(endpoint: IZapierEndpoint) {
		// TODO: Implement endpoint details view
		console.log('Opening endpoint details:', endpoint);
	}
}

import { Component, OnInit } from '@angular/core';
import { tap, catchError } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ZapierStoreService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IZapierEndpoint } from '@gauzy/contracts';

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
				if (settings && settings.access_token) {
					this.token = settings.access_token;
					this._loadTriggers();
					this._loadActions();
				} else {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER.ERRORS.NO_TOKEN'),
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
				})
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
				})
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

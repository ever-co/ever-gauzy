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
	styleUrls: ['./zapier.component.scss']
})
export class ZapierComponent extends TranslationBaseComponent implements OnInit {
	constructor(
		private readonly _zapierService: ZapierService,
		private readonly _zapierStoreService: ZapierStoreService,
		private readonly _toastrService: ToastrService,
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._loadTriggers();
		this._loadActions();
	}

	private _loadTriggers() {
		this._zapierStoreService.setLoading(true);
		this._zapierService
			.getTriggers()
			.pipe(
				tap((triggers: IZapierEndpoint[]) => {
					this._zapierStoreService.setTriggers(triggers);
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
				this._zapierStoreService.setLoading(false);
			});
	}

	private _loadActions() {
		this._zapierStoreService.setLoading(true);
		this._zapierService
			.getActions()
			.pipe(
				tap((actions: IZapierEndpoint[]) => {
					this._zapierStoreService.setActions(actions);
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
				this._zapierStoreService.setLoading(false);
			});
	}
}

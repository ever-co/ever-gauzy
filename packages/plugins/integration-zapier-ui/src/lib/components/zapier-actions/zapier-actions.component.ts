import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { tap, catchError, finalize } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { ZapierService, ToastrService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { IZapierEndpoint } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-zapier-actions',
	templateUrl: './zapier-actions.component.html',
	standalone: false
})
export class ZapierActionsComponent extends TranslationBaseComponent implements OnInit {
	public actions: IZapierEndpoint[] = [];
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
		this._loadActions();
	}

	private _loadActions() {
		this.loading = true;
		const integrationId = this._route.snapshot.params['id'];

		this._zapierService
			.getActions(integrationId)
			.pipe(
				tap((actions: IZapierEndpoint[]) => {
					this.actions = actions;
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.LOAD_ACTIONS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading Zapier actions:', error);
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
	openActionDetails(action: IZapierEndpoint) {
		// TODO: Implement action details view
		console.log('Opening action details:', action);
	}
}

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
	selector: 'ngx-zapier-triggers',
	templateUrl: './zapier-triggers.component.html',
	standalone: false
})
export class ZapierTriggersComponent extends TranslationBaseComponent implements OnInit {
	public triggers: IZapierEndpoint[] = [];
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
		this._loadTriggers();
	}

	private _loadTriggers() {
		this.loading = true;
		const integrationId = this._route.snapshot.params['id'];

		this._zapierService
			.getTriggers(integrationId)
			.pipe(
				tap((triggers: IZapierEndpoint[]) => {
					this.triggers = triggers;
				}),
				catchError((error) => {
					this._toastrService.error(
						this.getTranslation('INTEGRATIONS.ZAPIER_PAGE.ERRORS.LOAD_TRIGGERS'),
						this.getTranslation('TOASTR.TITLE.ERROR')
					);
					console.error('Error loading Zapier triggers:', error);
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
		console.log('Opening trigger details:', trigger);
	}
}

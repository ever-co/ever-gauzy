import { Component, OnInit } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IIntegrationSetting, IOrganization } from '@gauzy/contracts';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';
import { Store } from './../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	styleUrls: ['./view.component.scss'],
	templateUrl: './view.component.html',
	providers: [TitleCasePipe]
})
export class GauzyAIViewComponent extends TranslationBaseComponent implements OnInit {

	public organization$: Observable<IOrganization>; // Observable to hold the selected organization
	public settings$: Observable<IIntegrationSetting[]>;
	public settings: IIntegrationSetting[] = [];

	constructor(
		private readonly _router: Router,
		private readonly _activatedRoute: ActivatedRoute,
		public readonly translateService: TranslateService,
		private readonly _store: Store,
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Setting up the organization$ observable pipeline
		this.organization$ = this._store.selectedOrganization$.pipe(
			// Exclude falsy values from the emitted values
			filter((organization: IOrganization) => !!organization),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this)
		);
		this.settings$ = this._activatedRoute.data.pipe(
			// Update component state with fetched issues
			tap((settings: IIntegrationSetting[]) => {
				this.settings = settings;
			}),
			// Handle component lifecycle to avoid memory leaks
			untilDestroyed(this),
		);
	}

	/**
	 * Navigate to the "Integrations" page.
	*/
	navigateToIntegrations(): void {
		this._router.navigate(['/pages/integrations']);
	}

	/**
	 * Navigates to the 'Reset Integration' route within the GitHub integration setup wizard.
	 */
	navigateToResetIntegration(): void {
		this._router.navigate(['/pages/integrations/gauzy-ai/reset']);
	}
}

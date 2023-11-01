import { Component, OnInit } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from './../../../../../@shared/language-base';

@UntilDestroy({ checkProperties: true })
@Component({
	styleUrls: ['./view.component.scss'],
	templateUrl: './view.component.html',
	providers: [TitleCasePipe]
})
export class GauzyAIViewComponent extends TranslationBaseComponent implements OnInit {

	constructor(
		public readonly _translateService: TranslateService,
		private readonly _router: Router
	) {
		super(_translateService);
	}

	ngOnInit(): void { }

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

import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { NbIconLibraries } from '@nebular/theme';

@Component({
	selector: 'ngx-integration-zapier-layout',
	template: `
		<nb-card>
			<nb-card-header class="d-flex">
				<div class="d-flex align-items-center">
					<nb-icon icon="flash-outline" class="mr-2"></nb-icon>
					<h4 class="mb-0">{{ 'MENU.ZAPIER' | translate }}</h4>
				</div>
			</nb-card-header>
			<nb-card-body>
				<router-outlet></router-outlet>
			</nb-card-body>
		</nb-card>
	`
})
export class IntegrationZapierLayoutComponent {
	constructor(
		private readonly router: Router,
		private readonly translate: TranslateService,
		private readonly iconLibraries: NbIconLibraries
	) {
		this.iconLibraries.registerFontPack('ion', { iconClassPrefix: 'ion' });
	}

	navigateToZapier() {
		window.open('https://zapier.com', '_blank');
	}
}

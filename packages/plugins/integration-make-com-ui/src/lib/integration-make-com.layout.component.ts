import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-integration-make-com-layout',
	template: `
		<nb-card>
			<nb-card-header>
				<div class="d-flex justify-content-between align-items-center">
					<h4 class="title">
						{{ 'INTEGRATIONS.MAKE_COM.TITLE' | translate }}
					</h4>
					<button nbButton status="primary" (click)="navigateToSettings()">
						<nb-icon icon="settings-outline"></nb-icon>
						{{ 'INTEGRATIONS.MAKE_COM.SETTINGS' | translate }}
					</button>
				</div>
			</nb-card-header>
			<nb-card-body>
				<router-outlet></router-outlet>
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			:host {
				display: block;
				height: 100%;
			}
			.title {
				margin: 0;
			}
		`
	]
})
export class IntegrationMakeComLayoutComponent implements OnInit {
	constructor(
		private readonly router: Router,
		private readonly translateService: TranslateService
	) {}

	ngOnInit(): void {
		this.translateService.setDefaultLang('en');
	}

	navigateToSettings(): void {
		this.router.navigate(['/pages/integrations/make-com/settings']);
	}
}

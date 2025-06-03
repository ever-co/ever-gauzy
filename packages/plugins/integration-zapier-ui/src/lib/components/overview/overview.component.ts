import { Component } from '@angular/core';

@Component({
	selector: 'ngx-integration-zapier-overview',
	standalone: false,
	template: `
		<nb-card>
			<nb-card-body>
				<div class="text-center">
					<nb-icon icon="flash-outline" class="mb-3" style="font-size: 48px;"></nb-icon>
					<h4>{{ 'INTEGRATIONS.ZAPIER.OVERVIEW.TITLE' | translate }}</h4>
					<p class="text-muted">
						{{ 'INTEGRATIONS.ZAPIER.OVERVIEW.DESCRIPTION' | translate }}
					</p>
					<button nbButton status="primary" (click)="navigateToZapier()">
						<nb-icon icon="external-link-outline"></nb-icon>
						{{ 'INTEGRATIONS.ZAPIER.OVERVIEW.CONNECT' | translate }}
					</button>
				</div>
			</nb-card-body>
		</nb-card>
	`
})
export class OverviewComponent {
	navigateToZapier() {
		window.open('https://zapier.com', '_blank');
	}
}

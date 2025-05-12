import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { LocalDataSource } from 'angular2-smart-table';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-make-com-scenarios',
	template: `
		<nb-card>
			<nb-card-header>
				<div class="d-flex justify-content-between align-items-center">
					<h4>{{ 'INTEGRATIONS.MAKE_COM.SCENARIOS.TITLE' | translate }}</h4>
					<button nbButton status="primary" (click)="createScenario()">
						<nb-icon icon="plus-outline"></nb-icon>
						{{ 'INTEGRATIONS.MAKE_COM.SCENARIOS.CREATE' | translate }}
					</button>
				</div>
			</nb-card-header>
			<nb-card-body>
				<ng2-smart-table
					[settings]="settings"
					[source]="source"
					(userRowSelect)="onUserRowSelect($event)"
				>
				</ng2-smart-table>
			</nb-card-body>
		</nb-card>
	`,
	styles: [
		`
			:host {
				display: block;
			}
		`
	]
})
export class ScenariosComponent implements OnInit {
	settings: any;
	source: LocalDataSource = new LocalDataSource();

	constructor(private readonly translateService: TranslateService) {
		this.settings = {
			actions: {
				columnTitle: this.translateService.instant('INTEGRATIONS.MAKE_COM.SCENARIOS.ACTIONS'),
				add: false,
				edit: true,
				delete: true,
				position: 'right'
			},
			columns: {
				name: {
					title: this.translateService.instant('INTEGRATIONS.MAKE_COM.SCENARIOS.NAME'),
					type: 'string'
				},
				description: {
					title: this.translateService.instant('INTEGRATIONS.MAKE_COM.SCENARIOS.DESCRIPTION'),
					type: 'string'
				},
				status: {
					title: this.translateService.instant('INTEGRATIONS.MAKE_COM.SCENARIOS.STATUS'),
					type: 'string'
				},
				lastRun: {
					title: this.translateService.instant('INTEGRATIONS.MAKE_COM.SCENARIOS.LAST_RUN'),
					type: 'string'
				}
			}
		};
	}

	ngOnInit(): void {
		// TODO: Load scenarios data
	}

	createScenario(): void {
		// TODO: Implement scenario creation
		console.log('Create scenario clicked');
	}

	onUserRowSelect(event: any): void {
		// TODO: Handle row selection
		console.log('Selected row:', event.data);
	}
}

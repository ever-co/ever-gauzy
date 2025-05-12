import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { LocalDataSource } from 'angular2-smart-table';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-make-com-webhooks',
	template: `
		<nb-card>
			<nb-card-header>
				<div class="d-flex justify-content-between align-items-center">
					<h4>{{ 'INTEGRATIONS.MAKE_COM.WEBHOOKS.TITLE' | translate }}</h4>
					<button nbButton status="primary" (click)="createWebhook()">
						<nb-icon icon="plus-outline"></nb-icon>
						{{ 'INTEGRATIONS.MAKE_COM.WEBHOOKS.CREATE' | translate }}
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
export class WebhooksComponent implements OnInit {
	settings: any;
	source: LocalDataSource = new LocalDataSource();

	constructor(private readonly translateService: TranslateService) {
		this.settings = {
			actions: {
				columnTitle: this.translateService.instant('INTEGRATIONS.MAKE_COM.WEBHOOKS.ACTIONS'),
				add: false,
				edit: true,
				delete: true,
				position: 'right'
			},
			columns: {
				name: {
					title: this.translateService.instant('INTEGRATIONS.MAKE_COM.WEBHOOKS.NAME'),
					type: 'string'
				},
				url: {
					title: this.translateService.instant('INTEGRATIONS.MAKE_COM.WEBHOOKS.URL'),
					type: 'string'
				},
				status: {
					title: this.translateService.instant('INTEGRATIONS.MAKE_COM.WEBHOOKS.STATUS'),
					type: 'string'
				},
				createdAt: {
					title: this.translateService.instant('INTEGRATIONS.MAKE_COM.WEBHOOKS.CREATED_AT'),
					type: 'string'
				}
			}
		};
	}

	ngOnInit(): void {
		// TODO: Load webhooks data
	}

	createWebhook(): void {
		// TODO: Implement webhook creation
		console.log('Create webhook clicked');
	}

	onUserRowSelect(event: any): void {
		// TODO: Handle row selection
		console.log('Selected row:', event.data);
	}
}

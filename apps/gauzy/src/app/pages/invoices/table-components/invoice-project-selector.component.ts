import { Component, OnInit, OnDestroy } from '@angular/core';
import { OrganizationProjects } from '@gauzy/models';
import { Store } from '../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	template: `
		<ng-select
			[(items)]="projects"
			bindName="name"
			placeholder="{{ 'INVOICES_PAGE.SELECT_PROJECT' | translate }}"
			[(ngModel)]="project"
			(change)="selectProject($event)"
		>
			<ng-template ng-option-tmp let-item="item" let-index="index">
				{{ item.name }}
			</ng-template>
			<ng-template ng-label-tmp let-item="item">
				<div class="selector-template">
					<span>{{ item.name }}</span>
				</div>
			</ng-template>
		</ng-select>
	`,
	styles: []
})
export class InvoiceProjectsSelectorComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	project: OrganizationProjects;
	projects: OrganizationProjects[];
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private store: Store,
		private organizationProjectsService: OrganizationProjectsService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	value: any;
	rowData: any;

	ngOnInit() {
		this._loadProjects();
		this.project = this.rowData.project ? this.rowData.project : null;
	}

	private async _loadProjects() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (organization) => {
				if (organization) {
					const projects = await this.organizationProjectsService.getAll(
						[],
						{ organizationId: organization.id }
					);
					this.projects = projects.items;
				}
			});
	}

	selectProject($event) {
		this.rowData.project = $event;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

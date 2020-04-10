import { Component, OnInit, OnDestroy } from '@angular/core';
import { OrganizationProjects } from '@gauzy/models';
import { Store } from '../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';

@Component({
	template: `
		<ng-select
			[(items)]="projects"
			bindName="name"
			placeholder="All Projects"
			[(ngModel)]="selectedProject"
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
export class InvoiceAddProjectsComponent implements OnInit, OnDestroy {
	selectedProject: OrganizationProjects;
	projects: OrganizationProjects[];
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private store: Store,
		private organizationProjectsService: OrganizationProjectsService
	) {}

	value: any;
	rowData: any;

	ngOnInit() {
		this._loadProjects();
		this.selectedProject = this.rowData.selectedProject;
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

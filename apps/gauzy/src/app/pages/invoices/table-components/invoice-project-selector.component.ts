import { Component, OnInit, OnDestroy } from '@angular/core';
import { OrganizationProjects } from '@gauzy/models';
import { Store } from '../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { DefaultEditor } from 'ng2-smart-table';

@Component({
	template: `
		<nb-select
			fullWidth
			placeholder="{{ 'INVOICES_PAGE.SELECT_PROJECT' | translate }}"
			[(ngModel)]="project"
			(selectedChange)="selectProject($event)"
		>
			<nb-option *ngFor="let project of projects" [value]="project">
				{{ project.name }}
			</nb-option>
		</nb-select>
	`,
	styles: []
})
export class InvoiceProjectsSelectorComponent extends DefaultEditor
	implements OnInit, OnDestroy {
	project: OrganizationProjects;
	projects: OrganizationProjects[];
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private store: Store,
		private organizationProjectsService: OrganizationProjectsService
	) {
		super();
	}

	ngOnInit() {
		this._loadProjects();
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
					const project = this.projects.find(
						(p) => p.id === this.cell.newValue
					);
					this.project = project;
				}
			});
	}

	selectProject($event) {
		this.cell.newValue = $event.id;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

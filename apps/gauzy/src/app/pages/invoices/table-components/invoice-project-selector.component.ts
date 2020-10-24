import { Component, OnInit, OnDestroy } from '@angular/core';
import { IOrganizationProject } from '@gauzy/models';
import { Store } from '../../../@core/services/store.service';
import { filter } from 'rxjs/operators';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { DefaultEditor } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
@UntilDestroy({ checkProperties: true })
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
export class InvoiceProjectsSelectorComponent
	extends DefaultEditor
	implements OnInit, OnDestroy {
	project: IOrganizationProject;
	projects: IOrganizationProject[];

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
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe(async (organization) => {
				if (organization) {
					const tenantId = this.store.user.tenantId;
					const { id: organizationId } = organization;
					const projects = await this.organizationProjectsService.getAll(
						[],
						{ organizationId, tenantId }
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

	ngOnDestroy() {}
}

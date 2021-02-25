import { Component, OnInit, OnDestroy } from '@angular/core';
import { IOrganization, IOrganizationProject } from '@gauzy/contracts';
import { Store } from '../../../@core/services/store.service';
import { filter, tap } from 'rxjs/operators';
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
	organization: IOrganization;

	constructor(
		private store: Store,
		private organizationProjectsService: OrganizationProjectsService
	) {
		super();
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => (this.organization = organization)),
				tap(() => this._loadProjects()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadProjects() {
		const tenantId = this.store.user.tenantId;
		const { id: organizationId } = this.organization;
		this.organizationProjectsService
			.getAll([], { organizationId, tenantId })
			.then(({ items }) => {
				this.projects = items;
				this.project = this.projects.find(
					(p) => p.id === this.cell.newValue.id
				);
			});
	}

	selectProject($event) {
		this.cell.newValue = $event;
	}

	ngOnDestroy() {}
}

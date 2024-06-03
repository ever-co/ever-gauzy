import { Component, OnInit, OnDestroy } from '@angular/core';
import { IOrganization, IOrganizationProject } from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { DefaultEditor } from 'angular2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@gauzy/ui-sdk/common';
import { OrganizationProjectsService } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	template: `
		<nb-select
			fullWidth
			[placeholder]="'INVOICES_PAGE.SELECT_PROJECT' | translate"
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
export class InvoiceProjectsSelectorComponent extends DefaultEditor implements OnInit, OnDestroy {
	public project: IOrganizationProject;
	public projects: IOrganizationProject[];
	public organization: IOrganization;

	constructor(
		private readonly store: Store,
		private readonly organizationProjectsService: OrganizationProjectsService
	) {
		super();
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this._loadProjects()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private _loadProjects() {
		const tenantId = this.store.user.tenantId;
		const { id: organizationId } = this.organization;
		this.organizationProjectsService.getAll([], { organizationId, tenantId }).then(({ items }) => {
			this.projects = items;
			//
			const project: any = this.cell.getValue();
			//
			this.project = this.projects.find((p) => p.id === project['id']);
		});
	}

	/**
	 *
	 * @param $event
	 */
	selectProject($event) {
		this.cell.setValue($event);
	}

	ngOnDestroy() {}
}

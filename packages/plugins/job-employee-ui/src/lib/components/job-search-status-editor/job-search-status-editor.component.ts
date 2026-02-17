import { AfterViewInit, ChangeDetectorRef, Component, inject, Input, OnInit, ViewChild } from '@angular/core';
import { filter, tap } from 'rxjs';
import { Cell, DefaultEditor } from 'angular2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IEmployee, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { ToggleSwitcherComponent } from '@gauzy/ui-core/shared';
import { JobSearchStoreService } from '../../providers/job-search-store.service';

@UntilDestroy()
@Component({
	template: `
		<ngx-toggle-switcher
			[label]="false"
			(onSwitched)="updateJobSearchAvailability($event)"
			[value]="employee?.isJobSearchActive || false"
		></ngx-toggle-switcher>
	`,
	standalone: false
})
export class JobSearchStatusEditorComponent extends DefaultEditor implements AfterViewInit, OnInit {
	public organization!: IOrganization;
	public employee!: IEmployee;

	@Input() cell!: Cell;
	@ViewChild(ToggleSwitcherComponent) switcher!: ToggleSwitcherComponent;

	private readonly _cdr = inject(ChangeDetectorRef);
	private readonly _store = inject(Store);
	private readonly _jobSearchStoreService = inject(JobSearchStoreService);

	ngOnInit() {
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization): organization is IOrganization => !!organization),
				tap((organization) => {
					this.organization = organization;
					this.employee = this.cell.getRow()?.getData();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		if (!this.switcher || !this.employee) {
			return;
		}
		this.switcher.value = this.employee.isJobSearchActive ?? false;
		this._cdr.detectChanges();
	}

	/**
	 * Updates the job search availability status of an employee within the organization.
	 *
	 * `@param` isJobSearchActive - A boolean flag indicating whether the job search is active.
	 */
	async updateJobSearchAvailability(isJobSearchActive: boolean): Promise<void> {
		if (!this.organization || !this.employee) {
			return;
		}
		try {
			await this._jobSearchStoreService.updateJobSearchAvailability(
				this.organization,
				this.employee,
				isJobSearchActive
			);
		} catch (error) {
			console.error('Error while updating job search availability:', error);
		}
	}
}

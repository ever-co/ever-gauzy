import { Component, OnDestroy, OnInit } from '@angular/core';
import {
	IEditEntityByMemberInput,
	IEmployee,
	IOrganization,
	IOrganizationProject,
	PermissionsEnum
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { combineLatest, Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { Store } from '@gauzy/ui-core/common';
import { EmployeeStore, OrganizationProjectsService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ToastrService } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-edit-employee-projects',
	templateUrl: './edit-employee-projects.component.html',
	styles: [
		`
			:host {
				height: calc(100vh - 20.5rem);

				.container-projects {
					padding: 1rem;
					background-color: var(--gauzy-card-2);
					height: 100%;
				}

				nb-card {
					background-color: var(--gauzy-card-3) !important;
					border-radius: var(--card-border-radius);
				}
			}
		`
	]
})
export class EditEmployeeProjectsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	private subject$: Subject<boolean> = new Subject();
	public organizationProjects: IOrganizationProject[] = [];
	public employeeProjects: IOrganizationProject[] = [];
	public selectedEmployee: IEmployee;
	public organization: IOrganization;

	constructor(
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly toastrService: ToastrService,
		private readonly employeeStore: EmployeeStore,
		public readonly translateService: TranslateService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.subject$
			.pipe(
				tap(() => this.loadProjects()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.employeeStore.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				distinctUntilChange(),
				filter(([organization, employee]) => !!organization && !!employee),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployee = employee;
				}),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}

	async submitForm(formInput: IEditEntityByMemberInput, removed: boolean) {
		try {
			if (formInput.member) {
				await this.organizationProjectsService.updateByEmployee(formInput);
				this.loadProjects();
				this.toastrService.success(
					removed ? 'TOASTR.MESSAGE.EMPLOYEE_PROJECT_REMOVED' : 'TOASTR.MESSAGE.EMPLOYEE_PROJECT_ADDED'
				);
			}
		} catch (error) {
			this.toastrService.danger('TOASTR.MESSAGE.EMPLOYEE_EDIT_ERROR');
		}
	}

	/**
	 * Load organization & employee assigned projects
	 */
	private async loadProjects() {
		await this.loadSelectedEmployeeProjects();
		const organizationProjects = await this.getOrganizationProjects();

		this.organizationProjects = organizationProjects.filter(
			(item: IOrganizationProject) =>
				!this.employeeProjects.some((project: IOrganizationProject) => project.id === item.id)
		);
	}

	/**
	 * Get selected employee projects
	 *
	 * @returns
	 */
	private async loadSelectedEmployeeProjects() {
		if (
			!this.organization ||
			!this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
		) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { id: selectedEmployeeId } = this.selectedEmployee;

		this.employeeProjects = await this.organizationProjectsService.getAllByEmployee(selectedEmployeeId, {
			organizationId,
			tenantId
		});
	}

	/**
	 * Get organization projects
	 *
	 * @returns
	 */
	private async getOrganizationProjects(): Promise<IOrganizationProject[]> {
		if (
			!this.organization ||
			!this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
		) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		return (
			await this.organizationProjectsService.getAll([], {
				organizationId,
				tenantId
			})
		).items;
	}
}

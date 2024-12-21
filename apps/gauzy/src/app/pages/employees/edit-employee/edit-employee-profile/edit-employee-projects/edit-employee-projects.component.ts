import { Component, OnDestroy, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, Subject } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import {
	IEditEntityByMemberInput,
	IEmployee,
	IOrganization,
	IOrganizationProject,
	PermissionsEnum
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import {
	EmployeeStore,
	ErrorHandlingService,
	OrganizationProjectsService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

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
    ],
    standalone: false
})
export class EditEmployeeProjectsComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	private subject$: Subject<boolean> = new Subject();
	public organizationProjects: IOrganizationProject[] = [];
	public employeeProjects: IOrganizationProject[] = [];
	public selectedEmployee: IEmployee;
	public organization: IOrganization;

	constructor(
		public readonly translateService: TranslateService,
		private readonly _organizationProjectsService: OrganizationProjectsService,
		private readonly _toastrService: ToastrService,
		private readonly _employeeStore: EmployeeStore,
		private readonly _store: Store,
		private readonly _errorHandlingService: ErrorHandlingService
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
		const storeOrganization$ = this._store.selectedOrganization$;
		const storeEmployee$ = this._employeeStore.selectedEmployee$;
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

	/**
	 * Submits the form to update the employee's project association.
	 *
	 * If the `member` exists in the input, the method will either update or remove the employee's project assignment
	 * and provide feedback through a success or error toastr notification.
	 *
	 * @param input The input data containing information about the employee and the project.
	 * @param removed A flag indicating whether the employee was removed from or added to the project.
	 */
	async submitForm(input: IEditEntityByMemberInput, removed: boolean): Promise<void> {
		if (!this.organization || !input.member) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;

		try {
			// Update the employee's project assignment
			await this._organizationProjectsService.updateByEmployee({
				addedProjectIds: input.addedEntityIds,
				removedProjectIds: input.removedEntityIds,
				member: input.member,
				organizationId,
				tenantId
			});

			// Show success message based on the action performed (added or removed)
			const message = removed
				? 'TOASTR.MESSAGE.EMPLOYEE_PROJECT_REMOVED'
				: 'TOASTR.MESSAGE.EMPLOYEE_PROJECT_ADDED';
			this._toastrService.success(message);
		} catch (error) {
			// Show error message in case of failure
			this._toastrService.danger('TOASTR.MESSAGE.EMPLOYEE_EDIT_ERROR');
		} finally {
			// Notify subscribers that the operation is complete
			this.subject$.next(true);
		}
	}

	/**
	 * Loads organization and employee assigned projects.
	 *
	 * This method loads the projects assigned to the selected employee and all organization projects,
	 * then filters out the employee's assigned projects from the full list of organization projects.
	 */
	private async loadProjects(): Promise<void> {
		// Load employee projects and all organization projects
		await this.loadSelectedEmployeeProjects();

		// Get all organization projects
		const organizationProjects = await this.getOrganizationProjects();

		// Filter out employee's assigned projects from the organization projects list
		this.organizationProjects = organizationProjects.filter(
			(orgProject: IOrganizationProject) =>
				!this.employeeProjects.some((empProject: IOrganizationProject) => empProject.id === orgProject.id)
		);
	}

	/**
	 * Fetches projects assigned to the selected employee.
	 *
	 * This method loads the projects associated with the selected employee if the user has the necessary permissions
	 * and the organization is available.
	 *
	 * @returns A Promise that resolves once the employee projects are loaded.
	 */
	private async loadSelectedEmployeeProjects(): Promise<void> {
		if (
			!this.organization ||
			!this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
		) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;
		const { id: selectedEmployeeId } = this.selectedEmployee;

		try {
			// Fetch and assign employee projects to the component property
			this.employeeProjects = await this._organizationProjectsService.getAllByEmployee(selectedEmployeeId, {
				organizationId,
				tenantId
			});
		} catch (error) {
			console.error('Error loading selected employee projects:', error);
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Fetches all projects within the organization.
	 *
	 * This method retrieves all projects in the organization if the user has the required permissions
	 * and the organization is available.
	 *
	 * @returns A Promise that resolves to an array of organization projects.
	 */
	private async getOrganizationProjects(): Promise<IOrganizationProject[]> {
		if (
			!this.organization ||
			!this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
		) {
			return [];
		}

		const { id: organizationId, tenantId } = this.organization;

		try {
			// Fetch and return all organization projects
			const result = await this._organizationProjectsService.getAll([], {
				organizationId,
				tenantId
			});
			return result.items;
		} catch (error) {
			console.error('Error fetching organization projects:', error);
			// Handle errors
			this._errorHandlingService.handleError(error);
			return [];
		}
	}

	ngOnDestroy(): void {}
}

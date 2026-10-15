import { AfterViewInit, ChangeDetectorRef, Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router, UrlSerializer } from '@angular/router';
import { Location } from '@angular/common';
import { combineLatest, debounceTime } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import {
	EmployeeAgentSourceEnum,
	EmployeeKindEnum,
	IEmployee,
	IEmployeeAgentProfile,
	IFavorite,
	IImageAsset,
	IOrganization,
	ISelectedEmployee,
	IUser,
	PermissionsEnum
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ALL_EMPLOYEES_SELECTED } from '@gauzy/ui-core/shared';
import { EmployeesService, ErrorHandlingService, Store } from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-edit-employee',
	templateUrl: './edit-employee.component.html',
	styleUrls: ['./edit-employee.component.scss', '../../dashboard/dashboard.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class EditEmployeeComponent extends TranslationBaseComponent implements OnInit, OnDestroy, AfterViewInit {
	organization: IOrganization;
	selectedEmployee: IEmployee;
	selectedEmployeeFromHeader: ISelectedEmployee;

	avatarFailed = false;

	/**
	 * The agent profile of an agent employee (`kind = 'agent'`); `null` for a person. A profile that is
	 * `managedExternally` (e.g. an Ever Works agent) shows the read-only "Managed by …" banner.
	 */
	agentProfile: IEmployeeAgentProfile | null = null;

	/** Whether the agent is managed by Ever Works, as opposed to another external system. */
	get isManagedByEverWorks(): boolean {
		return this.agentProfile?.source === EmployeeAgentSourceEnum.EVER_WORKS;
	}

	get avatarUrl(): string | null {
		return this.selectedEmployee?.user?.image?.fullUrl || this.selectedEmployee?.user?.imageUrl || null;
	}

	constructor(
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly cdr: ChangeDetectorRef,
		private readonly _urlSerializer: UrlSerializer,
		private readonly _location: Location,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _employeesService: EmployeesService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedEmployee$
			.pipe(
				debounceTime(200),
				distinctUntilChange(),
				filter((employee: ISelectedEmployee) => !!employee && !!employee.id),
				tap((employee) => (this.selectedEmployeeFromHeader = employee)),
				tap(({ id }) => {
					this.cdr.detectChanges();
					this.router.navigate([
						'/pages/employees/edit',
						id,
						this.route.firstChild.snapshot.routeConfig.path
					]);
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		// Watch for both route data and parameter changes to handle navigation between different employees
		combineLatest([this.route.data, this.route.params])
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter(([data, params]) => !!data && !!data.employee && !!params && !!params.id),
				tap(([data, params]) => {
					// Clear previous employee data when navigating to a different employee
					if (this.selectedEmployee && this.selectedEmployee.id !== params.id) {
						this.selectedEmployee = null;
					}
				}),
				tap(([{ employee }, params]) => {
					this.selectedEmployee = employee;
					this.avatarFailed = false;
					this.loadAgentProfile(employee);
				}),
				tap(([{ employee }, params]) => {
					try {
						if (employee.startedWorkOn) {
							setTimeout(() => {
								this.store.selectedEmployee = {
									id: employee.id,
									firstName: employee.user.firstName,
									lastName: employee.user.lastName,
									fullName: employee.user.name,
									imageUrl: employee.user.imageUrl,
									tags: employee.user.tags || [],
									skills: employee.skills || []
								};
							}, 500);
						}
					} catch (error) {
						this.router.navigate(['/pages/employees']);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Loads the agent profile of an agent employee, for the "Managed by …" banner. A person has none, so
	 * nothing is requested for one.
	 *
	 * @param employee The employee shown on the page.
	 */
	private async loadAgentProfile(employee: IEmployee): Promise<void> {
		this.agentProfile = null;
		if (employee?.kind !== EmployeeKindEnum.AGENT) {
			return;
		}
		const profile = await this._employeesService.getAgentProfile(employee.id);
		// The page may have moved on to another employee while the profile was loading.
		if (this.selectedEmployee?.id === employee.id) {
			this.agentProfile = profile;
			this.cdr.markForCheck();
		}
	}

	/**
	 * Update the image asset for the selected employee
	 * @param image The image asset to update
	 */
	updateImage(image: IImageAsset) {
		try {
			if (image) {
				// Update the image for the selected employee
				this.selectedEmployee.user.image = image;
				this.avatarFailed = false;

				// Alternatively, update the selectedEmployee in the store with the new image URL
				this.store.selectedEmployee = {
					...this.store.selectedEmployee,
					imageUrl: image?.fullUrl
				};
			}
		} catch (error) {
			console.error('Error while updating profile avatar:', error);
			// Handle and log errors
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Create URL tree for edit public employee page
	 *
	 * @returns
	 */
	editPublicPage() {
		if (!this.organization || !this.selectedEmployee) {
			return;
		}
		const { id, profile_link } = this.organization;
		const { id: employeeId, profile_link: employeeProfileLink } = this.selectedEmployee;

		// The call to Location.prepareExternalUrl is the key thing here.
		let tree = this.router.createUrlTree([
			`/share/organization/${profile_link}/${id}/${employeeProfileLink}/${employeeId}`
		]);

		// As far as I can tell you don't really need the UrlSerializer.
		const externalUrl = this._location.prepareExternalUrl(this._urlSerializer.serialize(tree));
		window.open(externalUrl, '_blank');
	}

	/**
	 * Handle favorite toggle event
	 */
	onFavoriteToggled(_event: { isFavorite: boolean; favorite?: IFavorite }): void {
		// The FavoriteToggleComponent already shows success/error messages
		// Additional logic can be added here if needed (analytics, state updates, etc.)
	}

	ngOnDestroy() {
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user: IUser) => {
					if (!!user && this.store.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
						this.store.selectedEmployee = ALL_EMPLOYEES_SELECTED;
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}
}

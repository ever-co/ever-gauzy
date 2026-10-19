import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { IOrganization, PermissionsEnum, IOrganizationContact, IEmployee, IOrganizationAward } from '@gauzy/contracts';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable, of, Subject } from 'rxjs';
import { catchError, debounceTime, map, shareReplay, tap } from 'rxjs/operators';
import moment from 'moment';
import {
	DateRangePickerBuilderService,
	EmployeeStatisticsService,
	EmployeesService,
	ErrorHandlingService,
	OrganizationsService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { PublicPageOrganizationMutationComponent } from '../mutation/public-page-organization-mutation/public-page-organization-mutation.component';

/** The sections of the public page, in tab order. */
export type OrganizationPublicTab = 'profile' | 'employees' | 'portfolio' | 'clients';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-public-organization',
	templateUrl: './organization.component.html',
	styleUrls: ['./organization.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class OrganizationComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public hasEditPublicPage$: Observable<boolean> = of(false);
	public organization: IOrganization;
	public organization$: Observable<IOrganization>;
	public employees$: Observable<IEmployee[]> = of([]);
	public employeeCount$: Observable<number | null> = of(null);
	public clients$: Observable<IOrganizationContact[]> = of([]);
	public clientCounts$: Observable<number | null> = of(null);
	public projectCounts$: Observable<number | null> = of(null);
	public bonusesPaid = 0;
	public totalIncome = 0;
	public profits = 0;
	public imageUrl: string;
	public hoverState: boolean;
	public imageUpdateButton = false;
	public activeTab: OrganizationPublicTab = 'profile';

	/**
	 * Reload Resolver Subject
	 */
	reload$: Subject<boolean> = new Subject();

	constructor(
		readonly translateService: TranslateService,
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		private readonly organizationsService: OrganizationsService,
		private readonly toastrService: ToastrService,
		private readonly employeesService: EmployeesService,
		private readonly employeeStatisticsService: EmployeeStatisticsService,
		private readonly store: Store,
		private readonly dateRangePickerService: DateRangePickerBuilderService,
		private readonly dialogService: NbDialogService,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.hasEditPublicPage$ = this.store.userRolePermissions$.pipe(
			map(() => this.store.hasPermission(PermissionsEnum.PUBLIC_PAGE_EDIT))
		);
		this.organization$ = this.route.data.pipe(
			map(({ organization }) => organization),
			tap((organization: IOrganization) => (this.organization = organization)),
			tap((organization: IOrganization) => (this.imageUrl = organization.imageUrl)),
			tap(() => this.getEmployeesAndEmployeeCounts()),
			tap(() => this.getClientsAndClientCounts()),
			tap(() => this.getProjectCounts())
			// tap(() => this.getEmployeeStatistics())
		);
	}

	ngAfterViewInit(): void {
		this.reload$
			.pipe(
				debounceTime(100),
				tap(() => this.reloadResolver()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** The tabs this organization shows; Clients only when it publishes them. */
	tabs(organization: IOrganization): OrganizationPublicTab[] {
		return organization?.show_clients
			? ['profile', 'employees', 'portfolio', 'clients']
			: ['profile', 'employees', 'portfolio'];
	}

	selectTab(tab: OrganizationPublicTab): void {
		this.activeTab = tab;
	}

	/**
	 * Arrow keys, Home and End move between tabs, as the ARIA tab pattern
	 * expects; focus follows the selection.
	 */
	onTabKeydown(event: KeyboardEvent): void {
		const tabs = this.tabs(this.organization);
		const index = tabs.indexOf(this.activeTab);
		const rtl = (event.currentTarget as HTMLElement)?.closest('[dir=rtl]') !== null;
		const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key];

		let next: number;
		if (step) {
			next = (index + step + tabs.length) % tabs.length;
		} else if (event.key === 'Home') {
			next = 0;
		} else if (event.key === 'End') {
			next = tabs.length - 1;
		} else {
			return;
		}

		event.preventDefault();
		this.selectTab(tabs[next]);
		(event.currentTarget as HTMLElement)?.querySelector<HTMLElement>(`#org-tab-${tabs[next]}`)?.focus();
	}

	/** Up to two initials for an avatar without a picture. */
	initials(name: string): string {
		return (name || '')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0].toUpperCase())
			.join('');
	}

	/** A count that loaded; a failed or pending request is null and stays hidden. */
	isCount(value: number | null): boolean {
		return typeof value === 'number' && !Number.isNaN(value);
	}

	/** The comma-separated client focus as separate items. */
	clientFocus(organization: IOrganization): string[] {
		return (organization?.client_focus || '')
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
	}

	/** Awards, most recent year first. */
	sortedAwards(organization: IOrganization): IOrganizationAward[] {
		return [...(organization?.awards || [])].sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
	}

	/** The website as a link target; a bare domain gets a scheme so it is not resolved as a route. */
	websiteUrl(website: string): string {
		return /^https?:\/\//i.test(website) ? website : `https://${website}`;
	}

	/** The website without its scheme or trailing slash, as it reads in text. */
	websiteLabel(website: string): string {
		return website.replace(/^https?:\/\//i, '').replace(/\/$/, '');
	}

	/**
	 * Reload Resolver
	 */
	reloadResolver() {
		this.router.navigated = false;
		this.router.navigate([this.router.url]);
	}

	/**
	 * Updates the image url of the organization.
	 *
	 * @param url - The image url to be updated.
	 */
	updateImageUrl(url: string): void {
		this.imageUrl = url;
		this.imageUpdateButton = true;
	}

	/**
	 * Handles the error while uploading an image.
	 *
	 * @param event - The error event to be handled.
	 * @return {void} This function does not return a value.
	 */
	handleImageUploadError(event: any): void {
		console.log('Error while uploading image', event);
		this._errorHandlingService.handleError(event);
	}

	/**
	 * GET public information of the clients in the organization
	 * GET clients counts in the organization
	 *
	 * @returns
	 */
	private getClientsAndClientCounts() {
		if (!this.organization) {
			return;
		}

		// Extract the organization id and tenant id.
		const { id: organizationId } = this.organization;

		// Get the clients.
		if (!!this.organization.show_clients) {
			// Get the clients.
			this.clients$ = this.organizationsService
				.getAllPublicClients({ organizationId })
				.pipe(
					map(({ items }) => items),
					catchError(() => of([]))
				);
		}

		// Get the clients counts.
		if (!!this.organization.show_clients_count) {
			// Get the clients counts.
			this.clientCounts$ = this.organizationsService
				.getAllPublicClientCounts({ organizationId })
				.pipe(catchError(() => of(null)));
		}
	}

	/**
	 * GET project counts in the organization
	 *
	 * @returns
	 */
	private async getProjectCounts() {
		if (!this.organization) {
			return;
		}

		// Get the project counts.
		if (!!this.organization.show_projects_count) {
			// Extract the organization id and tenant id.
			const { id: organizationId } = this.organization;

			// Get the project counts.
			this.projectCounts$ = this.organizationsService
				.getAllPublicProjectCounts({ organizationId })
				.pipe(catchError(() => of(null)));
		}
	}

	/**
	 * GET public information of the employees in the organization
	 * GET employees counts in the organization
	 *
	 * @returns
	 */
	private async getEmployeesAndEmployeeCounts() {
		if (!this.organization) {
			return;
		}

		// Get the employees and employee counts.
		if (!!this.organization.show_employees_count) {
			// Extract the organization id and tenant id.
			const { id: organizationId } = this.organization;

			// One request feeds both the list and the count.
			const employees$ = this.employeesService
				.getAllPublic({ organizationId }, ['user', 'organizationPosition', 'skills'])
				.pipe(
					catchError(() => of(null)),
					shareReplay({ bufferSize: 1, refCount: true })
				);

			this.employees$ = employees$.pipe(map((result) => result?.items || []));
			this.employeeCount$ = employees$.pipe(map((result) => (result ? result.total : null)));
		}
	}

	/**
	 * GET public information of the employees in the organization
	 *
	 * @returns
	 */
	private async getEmployeeStatistics() {
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;

		let startDate = moment().startOf('month').toDate();
		let endDate = moment().endOf('month').toDate();

		if (this.dateRangePickerService.selectedDateRange) {
			const selectedDateRange = this.dateRangePickerService.selectedDateRange;
			startDate = selectedDateRange.startDate;
			endDate = selectedDateRange.endDate;
		}

		const statistics = await this.employeeStatisticsService.getAggregateStatisticsByOrganizationId({
			organizationId,
			tenantId,
			startDate,
			endDate
		});
		if (!!this.organization.show_bonuses_paid) {
			this.bonusesPaid = statistics.total.bonus;
		}
		if (!!this.organization.show_income) {
			this.totalIncome = statistics.total.income;
		}
		if (!!this.organization.show_profits) {
			this.profits = statistics.total.profit;
		}
	}

	async saveImage(organization: any) {
		await this.organizationsService.update(this.organization.id, organization);
		this.imageUpdateButton = false;
		this.toastrService.success('TOASTR.MESSAGE.IMAGE_UPDATED');
	}

	/**
	 * Opens a dialog to edit the public page of the organization and updates the organization data if successful.
	 *
	 * @return {void}
	 */
	editPublicPage(): void {
		if (!this.organization) {
			return;
		}

		// Open the dialog.
		const dialog$ = this.dialogService.open(PublicPageOrganizationMutationComponent, {
			context: {
				organization: this.organization
			}
		});

		// Close the dialog.
		dialog$.onClose
			.pipe(
				tap(() => this._changeClientsTabIfActiveAndPrivacyIsTurnedOff()),
				untilDestroyed(this)
			)
			.subscribe(async (result) => {
				if (!!result) {
					await this.organizationsService.update(this.organization.id, {
						...result,
						currency: this.organization.currency,
						defaultValueDateType: this.organization.defaultValueDateType
					});

					// Display a success toastr.
					const { name } = this.organization;
					this.toastrService.success('TOASTR.MESSAGE.ORGANIZATION_PAGE_UPDATED', { name });

					// Reload the resolver.
					this.reload$.next(true);
				}
			});
	}

	/**
	 * If clients tab is active and privacy mutation turned off clients view.
	 * We have to removed clients tab from UI and default select profile tab.
	 */
	private _changeClientsTabIfActiveAndPrivacyIsTurnedOff() {
		if (this.activeTab === 'clients' && !this.organization.show_clients) {
			this.selectTab('profile');
		}
	}

	ngOnDestroy() {}
}

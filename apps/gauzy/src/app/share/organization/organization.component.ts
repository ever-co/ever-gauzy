import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { IOrganization, PermissionsEnum, IOrganizationContact, IEmployee } from '@gauzy/contracts';
import { NbDialogService, NbTabComponent, NbTabsetComponent } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable, of as observableOf, Subject } from 'rxjs';
import { debounceTime, map, tap } from 'rxjs/operators';
import * as moment from 'moment';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store } from '@gauzy/ui-core/common';
import {
	DateRangePickerBuilderService,
	EmployeeStatisticsService,
	EmployeesService,
	OrganizationsService,
	ToastrService
} from '@gauzy/ui-core/core';
import { PublicPageMutationComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-public-organization',
	templateUrl: './organization.component.html',
	styleUrls: ['./organization.component.scss']
})
export class OrganizationComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public hasEditPublicPage$: Observable<boolean> = observableOf(false);
	public organization: IOrganization;
	public organization$: Observable<IOrganization>;
	public employees$: Observable<IEmployee[]> = observableOf([]);
	public employeeCounts$: Observable<Number> = observableOf(0);
	public clients$: Observable<IOrganizationContact[]> = observableOf([]);
	public clientCounts$: Observable<Number> = observableOf(0);
	public projectCounts$: Observable<Number> = observableOf(0);

	bonusesPaid = 0;
	totalIncome = 0;
	profits = 0;

	imageUrl: string;
	hoverState: boolean;
	imageUpdateButton = false;

	/**
	 * Reload Resolver Subject
	 */
	reload$: Subject<boolean> = new Subject();
	/**
	 * Tabset Type of the ViewChild metadata.
	 */
	@ViewChild('tabset') tabsetEl: NbTabsetComponent;
	@ViewChild('profileTab') profileTabEl: NbTabComponent;

	constructor(
		private readonly router: Router,
		private readonly route: ActivatedRoute,
		private readonly organizationsService: OrganizationsService,
		private readonly toastrService: ToastrService,
		private readonly employeesService: EmployeesService,
		private readonly employeeStatisticsService: EmployeeStatisticsService,
		private readonly store: Store,
		private readonly dateRangePickerService: DateRangePickerBuilderService,
		private readonly dialogService: NbDialogService,
		readonly translateService: TranslateService
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

	/**
	 * Reload Resolver
	 */
	reloadResolver() {
		this.router.navigated = false;
		this.router.navigate([this.router.url]);
	}

	updateImageUrl(url: string) {
		this.imageUrl = url;
		this.imageUpdateButton = true;
	}

	handleImageUploadError(event: any) {}

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
		const { id: organizationId } = this.organization;
		if (!!this.organization.show_clients) {
			this.clients$ = this.organizationsService
				.getAllPublicClients({ organizationId })
				.pipe(map(({ items }) => items));
		}
		if (!!this.organization.show_clients_count) {
			this.clientCounts$ = this.organizationsService.getAllPublicClientCounts({ organizationId });
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
		if (!!this.organization.show_projects_count) {
			const { id: organizationId } = this.organization;
			this.projectCounts$ = this.organizationsService.getAllPublicProjectCounts({ organizationId });
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
		const { id: organizationId } = this.organization;
		if (!!this.organization.show_employees_count) {
			this.employees$ = this.employeesService
				.getAllPublic({ organizationId }, ['user', 'organizationPosition', 'skills'])
				.pipe(
					tap(({ total }) => (this.employeeCounts$ = observableOf(total))),
					map(({ items }) => items)
				);
		}
	}

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
		const dialog$ = this.dialogService.open(PublicPageMutationComponent, {
			context: {
				organization: this.organization
			}
		});
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
					this.toastrService.success('TOASTR.MESSAGE.ORGANIZATION_PAGE_UPDATED', {
						name: this.organization.name
					});
					this.reload$.next(true);
				}
			});
	}

	/**
	 * If clients tab is active and privacy mutation turned off clients view.
	 * We have to removed clients tab from UI and default select profile tab.
	 */
	private _changeClientsTabIfActiveAndPrivacyIsTurnedOff() {
		if (!this.organization.show_clients) {
			this.tabsetEl.selectTab(this.profileTabEl);
		}
	}

	ngOnDestroy() {}
}

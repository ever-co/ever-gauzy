import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import {
	IProposal,
	ComponentLayoutStyleEnum,
	IOrganization,
	IProposalViewModel,
	ProposalStatusEnum,
	IOrganizationContact,
	IDateRangePicker,
	ITag
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange, toUTC } from '@gauzy/common-angular';
import * as moment from 'moment';
import {
	ContactLinksComponent,
	DateViewComponent,
	EmployeeLinksComponent,
	NotesWithTagsComponent,
	TagsOnlyComponent
} from '../../@shared/table-components';
import { ActionConfirmationComponent, DeleteConfirmationComponent } from '../../@shared/user/forms';
import { IPaginationBase, PaginationFilterBaseComponent } from '../../@shared/pagination/pagination-filter-base.component';
import { API_PREFIX, ComponentEnum } from '../../@core/constants';
import { StatusBadgeComponent } from '../../@shared/status-badge';
import {
	ErrorHandlingService,
	ProposalsService,
	Store,
	ToastrService
} from '../../@core/services';
import { ServerDataSource } from '../../@core/utils/smart-table';
import {
	InputFilterComponent,
	OrganizationContactFilterComponent,
	TagsColorFilterComponent
} from '../../@shared/table-filters';
import { getAdjustDateRangeFutureAllowed } from '../../@theme/components/header/selectors/date-range-picker';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-proposals',
	templateUrl: './proposals.component.html',
	styleUrls: ['./proposals.component.scss']
})
export class ProposalsComponent extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy {

	smartTableSettings: object;
	employeeId: string | null;
	selectedDateRange: IDateRangePicker;
	proposals: IProposalViewModel[];
	smartTableSource: ServerDataSource;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	viewComponentName: ComponentEnum = ComponentEnum.PROPOSALS;
	selectedProposal: IProposalViewModel;
	proposalStatusEnum = ProposalStatusEnum;
	successRate: string;
	totalProposals: number;
	countAccepted: number = 0;
	loading: boolean = false;
	disableButton: boolean = true;
	organization: IOrganization;
	proposals$: Subject<any> = this.subject$;

	proposalsTable: Ng2SmartTableComponent;
	@ViewChild('proposalsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.proposalsTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private readonly store: Store,
		private readonly router: Router,
		private readonly proposalsService: ProposalsService,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService,
		private readonly errorHandler: ErrorHandlingService,
		readonly translateService: TranslateService,
		private readonly httpClient: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.proposals$
			.pipe(
				debounceTime(100),
				tap(() => this.clearItem()),
				tap(() => this.getProposals()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.proposals$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const selectedDateRange$ = this.store.selectedDateRange$;
		combineLatest([storeOrganization$, storeEmployee$, selectedDateRange$])
			.pipe(
				debounceTime(500),
				filter(([organization]) => !!organization),
				distinctUntilChange(),
				tap(([organization, employee, dateRange]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
					this.employeeId = employee ? employee.id : null;
				}),
				tap(() => this.refreshPagination()),
				tap(() => this.proposals$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		const { employeeId } = this.store.user;
		if (employeeId) {
			delete this.smartTableSettings['columns']['author'];
			this.smartTableSettings = Object.assign(
				{},
				this.smartTableSettings
			);
		}
	}

	setView() {
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap(
					(componentLayout) =>
						(this.dataLayoutStyle = componentLayout)
				),
				filter(
					(componentLayout) =>
						componentLayout === ComponentLayoutStyleEnum.CARDS_GRID
				),
				tap(() => this.refreshPagination()),
				tap(() => this.proposals$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.proposalsTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	details(selectedItem?: IProposal) {
		if (selectedItem) {
			this.selectProposal({
				isSelected: true,
				data: selectedItem
			});
		}
		if (this.selectedProposal) {
			this.router.navigate([`/pages/sales/proposals/details`, this.selectedProposal.id]);
		}
	}

	delete(selectedItem?: IProposal) {
		if (selectedItem) {
			this.selectProposal({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Proposal'
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						if (this.selectedProposal) {
							await this.proposalsService.delete(this.selectedProposal.id).then(() => {
								this.toastrService.success('NOTES.PROPOSALS.DELETE_PROPOSAL');
							});
						}
					} catch (error) {
						this.errorHandler.handleError(error);
					} finally {
						this.proposals$.next(true);
					}
				}
			});
	}

	switchToAccepted(selectedItem?: IProposal) {
		if (selectedItem) {
			this.selectProposal({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(ActionConfirmationComponent, {
				context: {
					recordType: 'status'
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						if (this.selectedProposal) {
							const { tenantId } = this.store.user;
							await this.proposalsService.updateAction(this.selectedProposal.id, {
								status: ProposalStatusEnum.ACCEPTED,
								tenantId
							}).then(() => {
								// TODO translate
								this.toastrService.success('NOTES.PROPOSALS.PROPOSAL_ACCEPTED');
							});
						}
					} catch (error) {
						this.errorHandler.handleError(error);
					} finally {
						this.proposals$.next(true);
					}
				}
			});
	}

	switchToSent(selectedItem?: IProposal) {
		if (selectedItem) {
			this.selectProposal({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(ActionConfirmationComponent, {
				context: {
					recordType: 'status'
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						if (this.selectedProposal) {
							const { tenantId } = this.store.user;
							await this.proposalsService.updateAction(this.selectedProposal.id, {
								status: ProposalStatusEnum.SENT,
								tenantId
							}).then(() => {
								this.toastrService.success('NOTES.PROPOSALS.PROPOSAL_SENT');
							});
						}
					} catch (error) {
						this.errorHandler.handleError(error);
					} finally {
						this.proposals$.next(true);
					}
				}
			});
	}

	private statusMapper = (cell: string) => {
		let badgeClass: string;
		if (cell === ProposalStatusEnum.SENT) {
			badgeClass = 'warning';
			cell = this.getTranslation('BUTTONS.SENT');
		} else {
			badgeClass = 'success';
			cell = this.getTranslation('BUTTONS.ACCEPTED');
		}
		return {
			text: cell,
			class: badgeClass
		};
	};

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.smartTableSettings = {
			actions: false,
			editable: true,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA_MESSAGE'),
			columns: {
				valueDate: {
					title: this.getTranslation('SM_TABLE.DATE'),
					type: 'custom',
					width: '10%',
					renderComponent: DateViewComponent,
					filter: false,
					sortDirection: 'desc'
				},
				jobTitle: {
					title: this.getTranslation('SM_TABLE.JOB_TITLE'),
					type:
						this.dataLayoutStyle === ComponentLayoutStyleEnum.TABLE
							? 'custom'
							: 'string',
					width: '25%',
					renderComponent:
						this.dataLayoutStyle === ComponentLayoutStyleEnum.TABLE
							? NotesWithTagsComponent
							: null,
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value: string) => {
						this.setFilter({
							field: 'jobPostContent',
							search: value
						});
					}
				},
				jobPostUrl: {
					title: this.getTranslation('SM_TABLE.JOB_POST_URL'),
					type: 'html',
					width: '25%',
					filter: false
				},
				organizationContact: {
					title: this.getTranslation('SM_TABLE.CONTACT_NAME'),
					type: 'custom',
					renderComponent: ContactLinksComponent,
					width: '20%',
					filter: {
						type: 'custom',
						component: OrganizationContactFilterComponent
					},
					filterFunction: (value: IOrganizationContact | null) => {
						this.setFilter({
							field: 'organizationContactId',
							search: value?.id || null
						});
					}
				},
				author: {
					title: this.getTranslation('SM_TABLE.AUTHOR'),
					type: 'custom',
					width: '20%',
					filter: false,
					renderComponent: EmployeeLinksComponent,
					valuePrepareFunction: (value, item) => {
						return Object.assign(
							{},
							item.author,
							{ imageUrl: item.author?.user?.imageUrl }
						)
					},
				},
				statusBadge: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					width: '5%',
					class: 'text-center',
					filter: false,
					renderComponent: StatusBadgeComponent
				}
			}
		};
		if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
			this.smartTableSettings['columns']['tags'] = {
				title: this.getTranslation('SM_TABLE.TAGS'),
				type: 'custom',
				width: '20%',
				class: 'align-row',
				renderComponent: TagsOnlyComponent,
				filter: {
					type: 'custom',
					component: TagsColorFilterComponent
				},
				filterFunction: (tags: ITag[]) => {
					const tagIds = [];
					for (const tag of tags) { tagIds.push(tag.id); }
					this.setFilter({ field: 'tags', search: tagIds });
				},
				sort: false
			};
		}
	}

	selectProposal({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedProposal = isSelected ? data : null;
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		this.loading = true;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const request = {};
		if (this.employeeId) {
			request['employeeId'] = this.employeeId;
			delete this.smartTableSettings['columns']['author'];
		}

		const { startDate, endDate } = getAdjustDateRangeFutureAllowed(this.selectedDateRange);
		if (startDate && endDate) {
			request['valueDate'] = {};
			if (moment(startDate).isValid()) {
				request['valueDate']['startDate'] = toUTC(startDate).format('YYYY-MM-DD HH:mm:ss');
			}
			if (moment(endDate).isValid()) {
				request['valueDate']['endDate'] = toUTC(endDate).format('YYYY-MM-DD HH:mm:ss');
			}
		}
		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/proposal/pagination`,
			relations: [
				'organization',
				'employee',
				'employee.user',
				'tags',
				'organizationContact'
			],
			join: {
				...(this.filters.join ? this.filters.join : {})
			},
			where: {
				...{ organizationId, tenantId },
				...request,
				...this.filters.where
			},
			resultMap: (proposal: IProposal) => {
				return this.proposalMapper(proposal);
			},
			finalize: () => {
				this.calculateStatistics();
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	private calculateStatistics() {
		this.countAccepted = 0;
		const proposals = this.smartTableSource.getData();
		for (const proposal of proposals) {
			if (proposal.status === ProposalStatusEnum.ACCEPTED) { this.countAccepted++; }
		}

		this.totalProposals = this.smartTableSource.count();
		if (this.totalProposals) {
			this.successRate = ((this.countAccepted / this.totalProposals) * 100).toFixed(0) + ' %';
		} else {
			this.successRate = '0 %';
		}
	}

	private proposalMapper = (i: IProposal) => {
		return {
			id: i.id,
			valueDate: i.valueDate,
			jobPostUrl: i.jobPostUrl
				? '<a href="' +
				i.jobPostUrl +
				`" target="_blank">${i.jobPostUrl}</a>`
				: '',
			jobTitle: i.jobPostContent
				.toString()
				.replace(/<[^>]*(>|$)|&nbsp;/g, '')
				.split(/[\s,\n]+/)
				.slice(0, 3)
				.join(' '),
			jobPostContent: i.jobPostContent,
			proposalContent: i.proposalContent,
			tags: i.tags,
			status: i.status,
			statusBadge: this.statusMapper(i.status),
			author: i.employee,
			organizationContact: i.organizationContact
				? i.organizationContact
				: null
		};
	};

	private async getProposals() {
		if (!this.organization) {
			return;
		}
		try {

			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(
				activePage,
				itemsPerPage,
				false
			);
			this.smartTableSource.setSort(
				[
					{
						field: 'valueDate',
						direction: 'desc'
					}
				],
				false
			);

			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				// Initiate GRID view pagination
				await this.smartTableSource.getElements();
				this.proposals = this.smartTableSource.getData();

				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	private clearItem() {
		this.selectProposal({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.proposalsTable && this.proposalsTable.grid) {
			this.proposalsTable.grid.dataSet['willSelect'] = 'false';
			this.proposalsTable.grid.dataSet.deselectAll();
		}
	}


	ngOnDestroy() { }
}

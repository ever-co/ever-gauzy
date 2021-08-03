import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import {
	IProposal,
	ComponentLayoutStyleEnum,
	IOrganization,
	IProposalViewModel,
	ProposalStatusEnum,
	IOrganizationContact
} from '@gauzy/contracts';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/common-angular';
import { combineLatest, Subject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import * as moment from 'moment';
import { DateViewComponent, NotesWithTagsComponent } from '../../@shared/table-components';
import { ActionConfirmationComponent, DeleteConfirmationComponent } from '../../@shared/user/forms';
import { PaginationFilterBaseComponent } from '../../@shared/pagination/pagination-filter-base.component';
import { API_PREFIX, ComponentEnum } from '../../@core/constants';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';
import { ErrorHandlingService, ProposalsService, Store, ToastrService } from '../../@core/services';
import { ServerDataSource } from '../../@core/utils/smart-table/server.data-source';
import { InputFilterComponent } from '../../@shared/table-filters/input-filter.component';
import { OrganizationContactFilterComponent } from '../../@shared/table-filters';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-proposals',
	templateUrl: './proposals.component.html',
	styleUrls: ['./proposals.component.scss']
})
export class ProposalsComponent
	extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy {

	proposalsTable: Ng2SmartTableComponent;
	@ViewChild('proposalsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.proposalsTable = content;
			this.onChangedSource();
		}
	}

	smartTableSettings: object;
	employeeId: string | null;
	selectedDate: Date;
	proposals: IProposalViewModel[];
	smartTableSource: ServerDataSource;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	viewComponentName: ComponentEnum = ComponentEnum.PROPOSALS;
	selectedProposal: IProposalViewModel;
	proposalStatusEnum = ProposalStatusEnum;
	proposalStatus: string;
	successRate: string;
	totalProposals: number;
	countAccepted: number = 0;
	loading: boolean;
	disableButton = true;
	organization: IOrganization;
	subject$: Subject<any> = new Subject();

	constructor(
		private readonly store: Store,
		private readonly router: Router,
		private readonly proposalsService: ProposalsService,
		private readonly toastrService: ToastrService,
		private readonly dialogService: NbDialogService,
		private readonly errorHandler: ErrorHandlingService,
		readonly translateService: TranslateService,
		private readonly httpClient: HttpClient,
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this.subject$
			.pipe(
				debounceTime(300),
				tap(() => this.loading = true),
				tap(() => this.clearItem()),
				tap(() => this.getProposals()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		const selectedDate$ = this.store.selectedDate$;
		combineLatest([storeOrganization$, storeEmployee$, selectedDate$])
			.pipe(
				debounceTime(500),
				filter(([organization]) => !!organization),
				tap(([organization]) => (this.organization = organization)),
				distinctUntilChange(),
				tap(([organization, employee, date]) => {
					if (organization) {
						this.selectedDate = date;
						this.employeeId = employee ? employee.id : null;
						this.refreshPagination();
						this.subject$.next();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		const { employeeId } = this.store.user;
		if (employeeId) {
			delete this.smartTableSettings['columns']['author'];
			this.smartTableSettings = Object.assign({}, this.smartTableSettings);
		}
	}

	setView() {
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => this.subject$.next()),
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
		this.router.navigate([ `/pages/sales/proposals/details`, this.selectedProposal.id]);
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
						await this.proposalsService.delete(
							this.selectedProposal.id
						);
						this.subject$.next();
						this.toastrService.success('NOTES.PROPOSALS.DELETE_PROPOSAL');
					} catch (error) {
						this.errorHandler.handleError(error);
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
						const { tenantId } = this.store.user;
						await this.proposalsService.update(
							this.selectedProposal.id,
							{ status: ProposalStatusEnum.ACCEPTED, tenantId }
						);
						this.subject$.next();
						// TODO translate
						this.toastrService.success(
							'NOTES.PROPOSALS.PROPOSAL_ACCEPTED'
						);
					} catch (error) {
						this.errorHandler.handleError(error);
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
						const { tenantId } = this.store.user;
						await this.proposalsService.update(
							this.selectedProposal.id,
							{ status: ProposalStatusEnum.SENT, tenantId }
						);
						this.subject$.next();
						this.toastrService.success('NOTES.PROPOSALS.PROPOSAL_SENT');
					} catch (error) {
						this.errorHandler.handleError(error);
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
	}

	private _loadSettingsSmartTable() {
		this.smartTableSettings = {
			actions: false,
			editable: true,
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
					type: 'custom',
					width: '25%',
					renderComponent: NotesWithTagsComponent,
					filter: {
						type: 'custom',
						component: InputFilterComponent,
					},
					filterFunction: (value: string) => {
						this.setFilter({ field: 'jobPostContent', search: value });
					}
				},
				jobPostUrl: {
					title: this.getTranslation('SM_TABLE.JOB_POST_URL'),
					type: 'html',
					width: '25%',
					filter: false
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					width: '10%',
					class: 'text-center',
					filter: false,
					renderComponent: StatusBadgeComponent
				},
				organizationContactName: {
					title: this.getTranslation('SM_TABLE.CONTACT_NAME'),
					type: 'text',
					width: '20%',
					filter: {
						type: 'custom',
						component: OrganizationContactFilterComponent
					},
					filterFunction: (value: IOrganizationContact| null) => {
						this.setFilter({ field: 'organizationContactId', search: (value)?.id || null });
					}
				},
				author: {
					title: this.getTranslation('SM_TABLE.AUTHOR'),
					type: 'string',
					width: '20%',
					filter: false
				}
			}
		};
	}

	selectProposal({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedProposal = isSelected ? data : null;

		if (this.selectedProposal) {
			this.proposalStatus = this.selectedProposal.status;
		}
	}

	/*
	* Register Smart Table Source Config 
	*/
	setSmartTableSource() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const request = {};
		if (this.employeeId) {
			request['employeeId'] = this.employeeId;
			delete this.smartTableSettings['columns']['author'];
		}
		if (moment(this.selectedDate).isValid()) {
			request['valueDate'] = moment(this.selectedDate).format('YYYY-MM-DD HH:mm:ss');
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
				...(this.filters.join) ? this.filters.join : {}
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
				this.loading = false;
				this.calculateStatistics();
			}
		});
	}

	private calculateStatistics() {
		this.countAccepted = 0
		const proposals = this.smartTableSource.getData();
		for (const proposal of proposals) {
			if (proposal.status === ProposalStatusEnum.ACCEPTED) {
				this.countAccepted++;
			}
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
			jobPostLink:
				'<a href="' +
				i.jobPostUrl +
				`" target="_blank">${i.jobPostUrl.substr(
					8,
					14
				)}</nb-icon></a>`,
			jobPostUrl: i.jobPostUrl,
			jobTitle: i.jobPostContent
				.toString()
				.replace(/<[^>]*(>|$)|&nbsp;/g, '')
				.split(/[\s,\n]+/)
				.slice(0, 3)
				.join(' '),
			jobPostContent: i.jobPostContent,
			proposalContent: i.proposalContent,
			tags: i.tags,
			status: this.statusMapper(i.status),
			author: i.employee ? i.employee.user ? i.employee.user.name : '' : '',
			organizationContact: i.organizationContact ? i.organizationContact : null,
			organizationContactName: i.organizationContact ? i.organizationContact.name : null
		};
	}

	private async getProposals() {
		try { 
			this.setSmartTableSource();
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {

				// Initiate GRID view pagination
				const { activePage, itemsPerPage } = this.pagination;
				this.smartTableSource.setPaging(activePage, itemsPerPage, false);
				this.smartTableSource.setSort(
					[{ field: 'valueDate', direction: 'desc' }], 
					false
				);

				await this.smartTableSource.getElements();
				this.proposals = this.smartTableSource.getData();

				const count = this.smartTableSource.count();
				this.pagination['totalItems'] =  count;
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSettingsSmartTable()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
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

	ngOnDestroy() {}
}

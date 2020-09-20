import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { takeUntil } from 'rxjs/operators';
import { LocalDataSource } from 'ng2-smart-table';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import {
	IProposal,
	PermissionsEnum,
	ITag,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/models';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { ProposalsService } from '../../@core/services/proposals.service';
import { TranslateService } from '@ngx-translate/core';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ActionConfirmationComponent } from '../../@shared/user/forms/action-confirmation/action-confirmation.component';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';

export interface ProposalViewModel {
	tags?: ITag[];
	valueDate: Date;
	id: string;
	employeeId?: string;
	organizationId?: string;
	jobPostUrl?: string;
	jobPostLink?: string;
	jobPostContent?: string;
	proposalContent?: string;
	status?: string;
	author?: string;
}

@Component({
	selector: 'ga-proposals',
	templateUrl: './proposals.component.html',
	styleUrls: ['./proposals.component.scss']
})
export class ProposalsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	constructor(
		private store: Store,
		private router: Router,
		private proposalsService: ProposalsService,
		private toastrService: NbToastrService,
		private dialogService: NbDialogService,
		private errorHandler: ErrorHandlingService,
		readonly translateService: TranslateService
	) {
		super(translateService);
		this.setView();
	}

	@ViewChild('proposalsTable') proposalsTable;

	smartTableSettings: object;
	selectedEmployeeId = '';
	selectedDate: Date;
	proposals: ProposalViewModel[];
	smartTableSource = new LocalDataSource();
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	viewComponentName: ComponentEnum;
	selectedProposal: ProposalViewModel;
	chartData: { value: number; name: string }[] = [];
	proposalStatus: string;
	employeeName: string;
	successRate: string;
	totalProposals: number;
	countAccepted = 0;
	showTable: boolean;
	loading = true;
	hasEditPermission = false;
	disableButton = true;
	private _selectedOrganizationId: string;
	private _ngDestroy$ = new Subject<void>();
	selectedOrganization: IOrganization;

	ngOnInit() {
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();

		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.ORG_PROPOSALS_EDIT
				);
			});

		this.store.selectedDate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((date) => {
				this.selectedDate = date;

				if (this.selectedEmployeeId) {
					this._loadTableData();
				} else {
					if (this._selectedOrganizationId) {
						this._loadTableData(this._selectedOrganizationId);
					}
				}
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this.selectedOrganization = org;
					this._selectedOrganizationId = org.id;
					this._loadTableData(this._selectedOrganizationId);
				}
			});

		this.store.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employee) => {
				if (employee && employee.id) {
					this.selectedEmployeeId = employee.id;
					this._loadTableData();
				} else {
					if (this._selectedOrganizationId) {
						this.selectedEmployeeId = null;
						this._loadTableData(this._selectedOrganizationId);
					}
				}

				this.loading = false;
			});

		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.PROPOSALS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	canShowTable() {
		if (this.proposalsTable) {
			this.proposalsTable.grid.dataSet.willSelect = 'false';
		}
		return this.showTable;
	}

	add() {
		this.router.navigate(['/pages/sales/proposals/register']);
	}

	details(selectedItem?: IProposal) {
		if (selectedItem) {
			this.selectProposal({
				isSelected: true,
				data: selectedItem
			});
		}
		this.router.navigate([
			`/pages/sales/proposals/details/${this.selectedProposal.id}`
		]);
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
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.proposalsService.delete(
							this.selectedProposal.id
						);

						this.toastrService.primary(
							this.getTranslation(
								'NOTES.PROPOSALS.DELETE_PROPOSAL'
							),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
						this._loadTableData();
						this.selectedProposal = null;
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
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.proposalsService.update(
							this.selectedProposal.id,
							{
								status: 'ACCEPTED'
							}
						);
						// TODO translate
						this.toastrService.primary(
							this.getTranslation(
								'NOTES.PROPOSALS.PROPOSAL_ACCEPTED'
							),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
						this.selectedProposal = null;
						this._loadTableData();
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
			.onClose.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.proposalsService.update(
							this.selectedProposal.id,
							{
								status: 'SENT'
							}
						);

						this.toastrService.primary(
							this.getTranslation(
								'NOTES.PROPOSALS.PROPOSAL_SENT'
							),
							this.getTranslation('TOASTR.TITLE.SUCCESS')
						);
						this.selectedProposal = null;
						this._loadTableData();
					} catch (error) {
						this.errorHandler.handleError(error);
					}
				}
			});
	}

	loadSettingsSmartTable() {
		this.smartTableSettings = {
			actions: false,
			editable: true,
			noDataMessage: 'No data',
			columns: {
				valueDate: {
					title: this.getTranslation('SM_TABLE.DATE'),
					type: 'custom',
					width: '25%',
					renderComponent: DateViewComponent,
					filter: false
				},
				jobTitle: {
					title: this.getTranslation('SM_TABLE.JOB_TITLE'),
					type: 'custom',
					width: '25%',
					renderComponent: NotesWithTagsComponent
				},
				jobPostUrl: {
					title: this.getTranslation('SM_TABLE.JOB_POST_URL'),
					type: 'html',
					filter: false
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					width: '10rem',
					class: 'text-center',
					filter: false,
					renderComponent: StatusBadgeComponent,
					valuePrepareFunction: (cell, row) => {
						let badgeClass;
						if (cell === 'SENT') {
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
				}
			}
		};

		if (!this.selectedEmployeeId) {
			this.smartTableSettings['columns'] = {
				...this.smartTableSettings['columns'],
				author: {
					title: this.getTranslation('SM_TABLE.AUTHOR'),
					type: 'string',
					width: '25%'
				}
			};
		}
	}

	selectProposal({ isSelected, data }) {
		const selectedProposal = isSelected ? data : null;
		if (this.proposalsTable) {
			this.proposalsTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedProposal = selectedProposal;
		this.store.selectedProposal = this.selectedProposal;
		if (this.selectedProposal) {
			this.proposalStatus = this.selectedProposal.status;
		}
	}

	private async _loadTableData(orgId?: string) {
		this.showTable = false;
		this.selectedProposal = null;
		this.disableButton = true;

		let items: IProposal[];
		if (this.selectedEmployeeId) {
			const response = await this.proposalsService.getAll(
				['employee', 'organization', 'tags'],
				{
					employeeId: this.selectedEmployeeId,
					organizationId: this._selectedOrganizationId,
					tenantId: this.selectedOrganization.tenantId
				},
				this.selectedDate
			);
			delete this.smartTableSettings['columns']['author'];
			items = response.items;
			this.totalProposals = response.total;
		} else {
			const response = await this.proposalsService.getAll(
				['organization', 'employee', 'employee.user', 'tags'],
				{
					organizationId: orgId,
					tenantId: this.selectedOrganization.tenantId
				},
				this.selectedDate
			);

			items = response.items;
			this.totalProposals = response.total;
		}

		this.countAccepted = 0;

		try {
			const proposalVM: ProposalViewModel[] = [...items]
				.sort(
					(a, b) =>
						new Date(b.valueDate).getTime() -
						new Date(a.valueDate).getTime()
				)
				.map((i) => {
					if (i.status === 'ACCEPTED') {
						this.countAccepted++;
					}

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
						status: i.status,
						author: i.employee.user
							? i.employee.user.firstName +
							  ' ' +
							  i.employee.user.lastName
							: ''
					};
				});

			if (this.totalProposals) {
				this.successRate =
					((this.countAccepted / this.totalProposals) * 100).toFixed(
						0
					) + ' %';
			} else {
				this.successRate = '0 %';
			}

			this.proposals = proposalVM;
			this.smartTableSource.load(proposalVM);
			this.showTable = true;

			this.chartData[0] = {
				name: 'Accepted Proposals',
				value: this.countAccepted
			};

			this.chartData[1] = {
				name: 'Total Proposals',
				value: this.totalProposals
			};
		} catch (error) {
			this.toastrService.danger(error.message, 'Error');
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSettingsSmartTable();
		});
	}

	ngOnDestroy() {
		delete this.smartTableSettings['columns']['author'];
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

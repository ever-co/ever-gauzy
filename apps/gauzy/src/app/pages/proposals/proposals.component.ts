import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { takeUntil } from 'rxjs/operators';
import { LocalDataSource } from 'ng2-smart-table';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import { Proposal, PermissionsEnum, Tag } from '@gauzy/models';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { ProposalsService } from '../../@core/services/proposals.service';
import { TranslateService } from '@ngx-translate/core';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ProposalStatusComponent } from './table-components/proposal-status/proposal-status.component';
import { ActionConfirmationComponent } from '../../@shared/user/forms/action-confirmation/action-confirmation.component';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';

export interface ProposalViewModel {
	id: string;
	employeeId?: string;
	organizationId?: string;
	valueDate: Date;
	jobPostUrl?: string;
	jobPostLink?: string;
	jobPostContent?: string;
	proposalContent?: string;
	status?: string;
	author?: string;
	tags?: Tag[];
}

interface SelectedRowModel {
	data: ProposalViewModel;
	isSelected: boolean;
	selected: ProposalViewModel[];
	source: LocalDataSource;
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
	}

	private _ngDestroy$ = new Subject<void>();

	smartTableSettings: object;
	selectedEmployeeId = '';
	selectedDate: Date;

	smartTableSource = new LocalDataSource();

	selectedProposal: SelectedRowModel;
	proposalStatus: string;
	showTable: boolean;
	employeeName: string;
	totalProposals: number;
	countAccepted = 0;
	successRate: string;
	chartData: { value: number; name: string }[] = [];
	loading = true;
	hasEditPermission = false;

	private _selectedOrganizationId: string;

	@ViewChild('proposalsTable') proposalsTable;

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
					this._selectedOrganizationId = org.id;
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

	details() {
		this.router.navigate([
			`/pages/sales/proposals/details/${this.selectedProposal.data.id}`
		]);
	}

	delete() {
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
							this.selectedProposal.data.id
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

	switchToAccepted() {
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
							this.selectedProposal.data.id,
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

	switchToSent() {
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
							this.selectedProposal.data.id,
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
					title: this.getTranslation('SM_TABLE.PROPOSAL_REGISTERED'),
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
				jobPostLink: {
					title: this.getTranslation('SM_TABLE.VIEW_JOB_POST'),
					type: 'html',
					filter: false
				},
				status: {
					title: this.getTranslation('SM_TABLE.STATUS'),
					type: 'custom',
					width: '10rem',
					class: 'text-center',
					filter: false,
					renderComponent: ProposalStatusComponent
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

	selectProposal(ev: SelectedRowModel) {
		this.selectedProposal = ev;
		this.store.selectedProposal = this.selectedProposal.data;
		this.proposalStatus = this.selectedProposal.data.status;
	}

	private async _loadTableData(orgId?: string) {
		this.showTable = false;
		this.selectedProposal = null;
		let items: Proposal[];
		if (this.selectedEmployeeId) {
			const response = await this.proposalsService.getAll(
				['employee', 'organization', 'tags'],
				{
					employeeId: this.selectedEmployeeId,
					organizationId: this._selectedOrganizationId
				},
				this.selectedDate
			);
			delete this.smartTableSettings['columns']['author'];
			items = response.items;
			this.totalProposals = response.total;
		} else {
			const response = await this.proposalsService.getAll(
				['organization', 'employee', 'employee.user', 'tags'],
				{ organizationId: orgId },
				this.selectedDate
			);

			items = response.items;
			this.totalProposals = response.total;
		}

		this.countAccepted = 0;

		try {
			const proposalVM: ProposalViewModel[] = items
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
							.replace(/<[^>]+>/g, '')
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
			this.toastrService.danger(error.message || error.message, 'Error');
		}
	}

	_applyTranslationOnSmartTable() {
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

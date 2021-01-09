import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { debounceTime, filter, tap, withLatestFrom } from 'rxjs/operators';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import {
	IProposal,
	ComponentLayoutStyleEnum,
	IOrganization,
	IProposalViewModel
} from '@gauzy/models';
import { Store } from '../../@core/services/store.service';
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
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../@core/services/toastr.service';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-proposals',
	templateUrl: './proposals.component.html',
	styleUrls: ['./proposals.component.scss']
})
export class ProposalsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	proposalsTable: Ng2SmartTableComponent;
	@ViewChild('proposalsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.proposalsTable = content;
			this.onChangedSource();
		}
	}

	smartTableSettings: object;
	selectedEmployeeId = '';
	selectedDate: Date;
	proposals: IProposalViewModel[];
	smartTableSource = new LocalDataSource();
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	viewComponentName: ComponentEnum;
	selectedProposal: IProposalViewModel;
	chartData: { value: number; name: string }[] = [];
	proposalStatus: string;
	employeeName: string;
	successRate: string;
	totalProposals: number;
	countAccepted = 0;
	showTable: boolean;
	loading = false;
	disableButton = true;
	selectedOrganization: IOrganization;

	constructor(
		private store: Store,
		private router: Router,
		private proposalsService: ProposalsService,
		private toastrService: ToastrService,
		private dialogService: NbDialogService,
		private errorHandler: ErrorHandlingService,
		readonly translateService: TranslateService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this.store.selectedDate$
			.pipe(untilDestroyed(this))
			.subscribe((date) => {
				this.selectedDate = date;
				if (this.selectedOrganization) {
					this._loadTableData();
				}
			});
		const storeEmployee$ = this.store.selectedEmployee$;
		const storeOrganization$ = this.store.selectedOrganization$;
		storeEmployee$
			.pipe(
				filter((value) => !!value),
				debounceTime(200),
				withLatestFrom(storeOrganization$),
				untilDestroyed(this)
			)
			.subscribe(([employee]) => {
				if (employee && this.selectedOrganization) {
					this.selectedEmployeeId = employee.id;
					this._loadTableData();
				}
			});
		storeOrganization$
			.pipe(
				filter((value) => !!value),
				debounceTime(200),
				withLatestFrom(storeEmployee$),
				untilDestroyed(this)
			)
			.subscribe(([organization, employee]) => {
				this.selectedEmployeeId = employee ? employee.id : null;
				if (organization) {
					this.selectedOrganization = organization;
					this._loadTableData();
				}
			});
		this.router.events
			.pipe(untilDestroyed(this))
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
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
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
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						await this.proposalsService.delete(
							this.selectedProposal.id
						);

						this.toastrService.success(
							'NOTES.PROPOSALS.DELETE_PROPOSAL'
						);
						this._loadTableData();
						this.clearItem();
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
							{ status: 'ACCEPTED', tenantId }
						);
						// TODO translate
						this.toastrService.success(
							'NOTES.PROPOSALS.PROPOSAL_ACCEPTED'
						);
						this.clearItem();
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
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (result) => {
				if (result) {
					try {
						const { tenantId } = this.store.user;
						await this.proposalsService.update(
							this.selectedProposal.id,
							{ status: 'SENT', tenantId }
						);

						this.toastrService.success(
							'NOTES.PROPOSALS.PROPOSAL_SENT'
						);
						this.clearItem();
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
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA_MESSAGE'),
			columns: {
				valueDate: {
					title: this.getTranslation('SM_TABLE.DATE'),
					type: 'custom',
					width: '10%',
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
				},
				organizationContactName: {
					title: this.getTranslation('SM_TABLE.CONTACT_NAME'),
					type: 'text',
					valuePrepareFunction: (cell, row) => {
						return row.organizationContact
							? row.organizationContact.name
							: '';
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
		this.disableButton = !isSelected;
		this.selectedProposal = isSelected ? data : null;
		if (this.selectedProposal) {
			this.proposalStatus = this.selectedProposal.status;
		}
	}

	private async _loadTableData() {
		if (!this.selectedOrganization) {
			return;
		}
		this.loading = true;
		this.showTable = false;
		this.selectedProposal = null;
		this.disableButton = true;

		let items: IProposal[];
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.selectedOrganization;
		if (this.selectedEmployeeId) {
			const response = await this.proposalsService.getAll(
				['employee', 'organization', 'tags', 'organizationContact'],
				{
					employeeId: this.selectedEmployeeId,
					organizationId,
					tenantId
				},
				this.selectedDate
			);
			delete this.smartTableSettings['columns']['author'];
			items = response.items;
			this.totalProposals = response.total;
		} else {
			const response = await this.proposalsService.getAll(
				[
					'organization',
					'employee',
					'employee.user',
					'tags',
					'organizationContact'
				],
				{ organizationId, tenantId },
				this.selectedDate
			);
			items = response.items;
			this.totalProposals = response.total;
		}

		this.countAccepted = 0;

		try {
			const proposalVM: IProposalViewModel[] = [...items]
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
						author: i.employee
							? i.employee.user
								? i.employee.user.firstName +
								  ' ' +
								  i.employee.user.lastName
								: ''
							: '',
						organizationContact: i.organizationContact
							? i.organizationContact
							: null
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
				name: this.getTranslation('PROPOSALS_PAGE.ACCEPTED_PROPOSALS'),
				value: this.countAccepted
			};

			this.chartData[1] = {
				name: this.getTranslation('PROPOSALS_PAGE.TOTAL_PROPOSALS'),
				value: this.totalProposals
			};
		} catch (error) {
			this.toastrService.danger(error);
		}
		this.loading = false;
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSettingsSmartTable();
			});
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

	ngOnDestroy() {
		delete this.smartTableSettings['columns']['author'];
	}
}

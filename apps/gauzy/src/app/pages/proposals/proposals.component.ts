import { Component, OnInit } from '@angular/core';
import { first, takeUntil } from 'rxjs/operators';
import { LocalDataSource } from 'ng2-smart-table';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import { RolesEnum, Proposal } from '@gauzy/models';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { ProposalsService } from '../../@core/services/proposals.service';
import { TranslateService } from '@ngx-translate/core';
import { DateViewComponent } from '../../@shared/table-components/date-view/date-view.component';

export interface ProposalViewModel {
	id: string;
	employeeId?: string;
	valueDate: Date;
	jobPostUrl?: string;
	jobPostContent?: string;
	proposalContent?: string;
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
export class ProposalsComponent implements OnInit {
	constructor(
		private store: Store,
		private router: Router,
		private proposalsService: ProposalsService,
		private toastrService: NbToastrService,
		private route: ActivatedRoute,
		private translateService: TranslateService
	) {}

	private _ngDestroy$ = new Subject<void>();

	smartTableSettings: object;
	selectedEmployeeId: string;
	selectedDate: Date;

	smartTableSource = new LocalDataSource();

	selectedProposal: SelectedRowModel;
	showTable: boolean;
	employeeName: string;
	loading = true;

	// private _ngDestroy$ = new Subject<void>();
	private _selectedOrganizationId: string;

	ngOnInit() {
		this.store.selectedEmployee$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((employee) => {
				if (employee && employee.id) {
					this.selectedEmployeeId = employee.id;
					this._loadTableData();

					this._loadTableData();
				} else {
					if (this._selectedOrganizationId) {
						this.selectedEmployeeId = null;
						this._loadTableData();

						this.proposalsService.getAll().then((data) => {
							this.smartTableSource.load(data.items);
						});
					}
				}

				this.loading = false;
			});

		this.loadSettingsSmartTable();
		this._loadTableData();
	}

	add() {
		this.router.navigate(['/pages/proposals/register']);
	}

	edit() {
		this.router.navigate(['/pages/proposals/edit/:id']);
		// TODO: Implement edit logic
	}

	delete() {
		// TODO: Implement delete logic
	}

	changeStatus() {
		// TODO: Implement change status logic
	}

	loadSettingsSmartTable() {
		this.smartTableSettings = {
			actions: false,
			editable: true,
			noDataMessage: 'No data',
			columns: {
				valueDate: {
					title: 'Proposal Registered on',
					type: 'custom',
					width: '20%',
					renderComponent: DateViewComponent,
					filter: false
				},
				jobPostUrl: {
					title: 'View Proposal',
					type: 'string'
				},
				status: {
					title: 'Status',
					type: 'string'
				}
			}
		};

		if (this.selectedEmployeeId) {
			this.smartTableSettings['columns'] = {
				...this.smartTableSettings['columns'],
				author: {
					title: 'Author',
					type: 'string'
				}
			};
		}
	}

	selectProposal(ev: SelectedRowModel) {
		this.selectedProposal = ev;
	}

	private async _loadTableData() {
		this.showTable = false;
		try {
			const { items } = await this.proposalsService.getAll(['employee']);

			const proposalVM: ProposalViewModel[] = items.map((i) => {
				return {
					id: i.id,
					valueDate: i.valueDate,
					jobPostUrl: i.jobPostUrl,
					jobPostContent: i.jobPostContent,
					proposalContent: i.proposalContent
				};
			});

			this.smartTableSource.load(proposalVM);
			this.showTable = true;
		} catch (error) {
			this.toastrService.danger(
				error.error.message || error.message,
				'Error'
			);
		}
	}
}

import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { RequestApproval } from '@gauzy/models';
import { RequestApprovalService } from '../../@core/services/request-approval.service';
import { LocalDataSource } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { PermissionsEnum } from '@gauzy/models';
import { takeUntil, first } from 'rxjs/operators';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Store } from '../../@core/services/store.service';
import { RequestApprovalStatusComponent } from './table-components/request-approval-status/request-approval-status.component';
import { ApprovalPolicyComponent } from './table-components/approval-policy/approval-policy.component';
import { RequestApprovalMutationComponent } from '../../@shared/approvals/approvals-mutation.component';

export interface IApprovalsData {
	icon: string;
	title: string;
}

export interface SelectedRequestApproval {
	data: RequestApproval;
	isSelected: false;
}

@Component({
	selector: 'ngx-approvals',
	templateUrl: './approvals.component.html',
	styleUrls: ['./approvals.component.scss']
})
export class ApprovalsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	public settingsSmartTable: object;
	public loading = true;
	public selectedRequestApproval: RequestApproval;
	public listApprovals: IApprovalsData[] = [];
	public disableButton = true;
	public smartTableSource = new LocalDataSource();
	public hasEditPermission = false;
	public selectedEmployeeId: string;

	private ngDestroy$ = new Subject<void>();
	private selectedOrganizationId: string;

	@ViewChild('requestApprovalTable') requestApprovalTable;

	constructor(
		readonly translateService: TranslateService,
		private approvalRequestService: RequestApprovalService,
		private store: Store,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private router: Router
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.userRolePermissions$
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.REQUEST_APPROVAL_EDIT
				);
			});

		this.store.selectedEmployee$
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe((employee) => {
				if (employee && employee.id) {
					this.selectedEmployeeId = employee.id;
				}
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this.selectedOrganizationId = org.id;
					this.loadSettings();
				}
			});

		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.loadSettings();
		// this.initListApprovals();
	}

	async selectRequestApproval($event: SelectedRequestApproval) {
		if ($event.isSelected) {
			this.selectedRequestApproval = $event.data;
			this.disableButton = false;
			this.requestApprovalTable.grid.dataSet.willSelect = false;
		} else {
			this.disableButton = true;
		}
	}

	async loadSettings() {
		this.selectedRequestApproval = null;
		let items = [];
		if (this.selectedEmployeeId) {
			items = (
				await this.approvalRequestService.getByEmployeeId(
					this.selectedEmployeeId,
					['requestApprovals']
				)
			).items;
		} else {
			items = (
				await this.approvalRequestService.getAll([
					'approvalPolicy',
					'employeeApprovals'
				])
			).items;
		}
		this.loading = false;
		this.smartTableSource.load(items);
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation(
						'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_NAME'
					),
					type: 'string'
				},
				type: {
					title: this.getTranslation(
						'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_TYPE'
					),
					type: 'string',
					filter: false
				},
				min_count: {
					title: this.getTranslation(
						'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_MIN_COUNT'
					),
					type: 'number',
					filter: false
				},
				approvalPolicy: {
					title: this.getTranslation(
						'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_APPROVAL_POLICY'
					),
					type: 'custom',
					renderComponent: ApprovalPolicyComponent,
					filter: false
				},
				status: {
					title: this.getTranslation(
						'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_STATUS'
					),
					type: 'custom',
					renderComponent: RequestApprovalStatusComponent,
					filter: false
				}
			}
		};
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}

	// private initListApprovals() {
	//   this.listApprovals = [
	//     {
	//       icon: 'paper-plane-outline',
	//       title: 'Business Trip'
	//     },
	//     {
	//       icon: 'paper-plane-outline',
	//       title: 'Borrow Items'
	//     },
	//     {
	//       icon: 'paper-plane-outline',
	//       title: 'General Approval'
	//     },
	//     {
	//       icon: 'paper-plane-outline',
	//       title: 'Contract Approval'
	//     },
	//     {
	//       icon: 'paper-plane-outline',
	//       title: 'Payment Application'
	//     },
	//     {
	//       icon: 'paper-plane-outline',
	//       title: 'Car Rental Application'
	//     },
	//     {
	//       icon: 'paper-plane-outline',
	//       title: 'Job Referral Award'
	//     },
	//     {
	//       icon: 'paper-plane-outline',
	//       title: 'Procurement'
	//     }
	//   ]
	// }

	manageAppropvalPolicy() {
		this.router.navigate(['/pages/organization/approval-policy']);
	}

	async save() {
		const dialog = this.dialogService.open(
			RequestApprovalMutationComponent,
			{
				context: {
					requestApproval: this.selectedRequestApproval
				}
			}
		);
		const requestApproval = await dialog.onClose.pipe(first()).toPromise();

		this.selectedRequestApproval = null;
		this.disableButton = true;

		if (requestApproval) {
			this.toastrService.primary(
				this.getTranslation(
					'APPROVAL_REQUEST_PAGE.APPROVAL_REQUEST_SAVED'
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}

		this.loadSettings();
	}

	async delete() {}

	ngOnDestroy() {
		this.ngDestroy$.next();
		this.ngDestroy$.complete();
	}
}

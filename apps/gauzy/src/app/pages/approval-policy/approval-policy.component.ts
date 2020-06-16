import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ApprovalPolicy } from '@gauzy/models';
import { LocalDataSource } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { PermissionsEnum } from '@gauzy/models';
import { takeUntil, first } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { ApprovalPolicyMutationComponent } from '../../@shared/approval-policy/approval-policy-mutation.component';
import { ApprovalPolicyService } from '../../@core/services/approval-policy.service';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';

export interface SelectedApprovalPolicy {
	data: ApprovalPolicy;
	isSelected: false;
}

@Component({
	selector: 'ngx-approval-policy',
	templateUrl: './approval-policy.component.html',
	styleUrls: ['./approval-policy.component.scss']
})
export class ApprovalPolicyComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	public settingsSmartTable: object;
	public loading = true;
	public selectedApprovalPolicy: ApprovalPolicy;
	public disableButton = true;
	public smartTableSource = new LocalDataSource();
	public hasEditPermission = false;

	private ngDestroy$ = new Subject<void>();
	private selectedOrganizationId: string;
	private selectedTenantId: string;

	@ViewChild('approvalPolicyTable') approvalPolicyTable;

	constructor(
		readonly translateService: TranslateService,
		private store: Store,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private approvalPolicyService: ApprovalPolicyService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.userRolePermissions$
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe(() => {
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.APPROVAL_POLICY_EDIT
				);
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this.selectedOrganizationId = org.id;
					this.selectedTenantId = org.tenantId;
					this.loadSettings();
				}
			});

		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.loadSettings();
		// this.initListApprovals();
	}

	async selectEquipment($event: SelectedApprovalPolicy) {
		if ($event.isSelected) {
			this.selectedApprovalPolicy = $event.data;
			this.disableButton = false;
			this.approvalPolicyTable.grid.dataSet.willSelect = false;
		} else {
			this.disableButton = true;
		}
	}

	async loadSettings() {
		this.selectedApprovalPolicy = null;
		let findInput: ApprovalPolicy = {};
		if (this.selectedOrganizationId) {
			findInput = {
				organizationId: this.selectedOrganizationId
			};
		}

		const items = (
			await this.approvalPolicyService.getAll(['organization'], findInput)
		).items;
		this.loading = false;
		this.smartTableSource.load(items);
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation(
						'APPROVAL_POLICY_PAGE.APPROVAL_POLICY_NAME'
					),
					type: 'string'
				},
				type: {
					title: this.getTranslation(
						'APPROVAL_POLICY_PAGE.APPROVAL_POLICY_TYPE'
					),
					type: 'string',
					filter: false
				},
				description: {
					title: this.getTranslation(
						'APPROVAL_POLICY_PAGE.APPROVAL_POLICY_DESCRIPTION'
					),
					type: 'string',
					filter: false
				},
				approvalPolicy: {
					title: this.getTranslation(
						'APPROVAL_POLICY_PAGE.APPROVAL_POLICY_ORGANIZATION'
					),
					type: 'string',
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

	async save() {
		const dialog = this.dialogService.open(
			ApprovalPolicyMutationComponent,
			{
				context: {
					approvalPolicy: this.selectedApprovalPolicy,
					organizationId: this.selectedOrganizationId,
					tenantId: this.selectedTenantId
				}
			}
		);
		const requestApproval = await dialog.onClose.pipe(first()).toPromise();
		this.selectedApprovalPolicy = null;
		this.disableButton = true;

		if (requestApproval) {
			this.toastrService.primary(
				this.getTranslation('EQUIPMENT_PAGE.EQUIPMENT_SAVED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}

		this.loadSettings();
	}

	async selectApprovalPolicy($event: SelectedApprovalPolicy) {
		if ($event.isSelected) {
			this.selectedApprovalPolicy = $event.data;
			this.disableButton = false;
			this.approvalPolicyTable.grid.dataSet.willSelect = false;
		} else {
			this.disableButton = true;
		}
	}

	async delete() {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.approvalPolicyService.delete(
				this.selectedApprovalPolicy.id
			);
			this.loadSettings();
			this.toastrService.primary(
				this.getTranslation('EQUIPMENT_SHARING_PAGE.REQUEST_DELETED'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.disableButton = true;
	}

	ngOnDestroy() {
		this.ngDestroy$.next();
		this.ngDestroy$.complete();
	}
}

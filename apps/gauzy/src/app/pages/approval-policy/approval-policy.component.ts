import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ApprovalPolicy, ComponentLayoutStyleEnum } from '@gauzy/models';
import { LocalDataSource } from 'ng2-smart-table';
import { Subject } from 'rxjs';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { PermissionsEnum } from '@gauzy/models';
import { takeUntil, first } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { ApprovalPolicyMutationComponent } from '../../@shared/approval-policy/approval-policy-mutation.component';
import { ApprovalPolicyService } from '../../@core/services/approval-policy.service';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';

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
	approvalData: ApprovalPolicy[];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	private ngDestroy$ = new Subject<void>();
	private selectedOrganizationId: string;
	private selectedTenantId: string;

	@ViewChild('approvalPolicyTable') approvalPolicyTable;

	constructor(
		readonly translateService: TranslateService,
		private store: Store,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private approvalPolicyService: ApprovalPolicyService,
		private router: Router
	) {
		super(translateService);
		this.setView();
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
		this.router.events
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.APPROVAL_POLICY;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this.ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
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
		this.approvalData = items;
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
				description: {
					title: this.getTranslation(
						'APPROVAL_POLICY_PAGE.APPROVAL_POLICY_DESCRIPTION'
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

	async save(selectedItem?: ApprovalPolicy) {
		if (selectedItem) {
			this.selectApprovalPolicy({
				isSelected: true,
				data: selectedItem
			});
		}
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

	async selectApprovalPolicy({ isSelected, data }) {
		const selectedApprovalPolicy = isSelected ? data : null;
		if (this.approvalPolicyTable) {
			this.approvalPolicyTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedApprovalPolicy = selectedApprovalPolicy;
	}

	async delete(selectedItem?: ApprovalPolicy) {
		if (selectedItem) {
			this.selectApprovalPolicy({
				isSelected: true,
				data: selectedItem
			});
		}
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

import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import {
	IEquipmentSharing,
	ComponentLayoutStyleEnum,
	IEquipmentSharingPolicy,
	IOrganization
} from '@gauzy/models';
import { LocalDataSource } from 'ng2-smart-table';
import { FormGroup } from '@angular/forms';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { first, takeUntil } from 'rxjs/operators';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { Store } from '../../@core/services/store.service';
import { Subject } from 'rxjs';
import { Router, NavigationEnd, RouterEvent } from '@angular/router';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { EquipmentSharingPolicyService } from '../../@core/services/equipment-sharing-policy.service';
import { EquipmentSharingPolicyMutationComponent } from '../../@shared/equipment-sharing-policy/equipment-sharing-policy-mutation.component';

@Component({
	templateUrl: './equipment-sharing-policy.component.html',
	styleUrls: ['./equipment-sharing-policy.component.scss']
})
export class EquipmentSharingPolicyComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading = true;
	selectedEquipmentSharingPolicy: IEquipmentSharingPolicy;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	disableButton = true;
	ngDestroy$ = new Subject<void>();
	equipmentSharingPolicyData: IEquipmentSharingPolicy[];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	private _ngDestroy$ = new Subject<void>();
	selectedOrganization: IOrganization;

	@ViewChild('equipmentSharingPolicyTable')
	equipmentSharingPolicyTable;

	constructor(
		readonly translateService: TranslateService,
		private equipmentSharingPolicyService: EquipmentSharingPolicyService,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private store: Store,
		private router: Router
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this.selectedOrganization = org;
					this.loadSettings();
				}
			});

		this.loadSmartTable();
		this._applyTranslationOnSmartTable();

		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.EQUIPMENT_SHARING_POLICY;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation(
						'EQUIPMENT_SHARING_POLICY_PAGE.EQUIPMENT_SHARING_POLICY_NAME'
					),
					type: 'string'
				},
				description: {
					title: this.getTranslation(
						'EQUIPMENT_SHARING_POLICY_PAGE.EQUIPMENT_SHARING_POLICY_DESCRIPTION'
					),
					type: 'string',
					filter: false
				}
			}
		};
	}

	async save(selectedItem?: IEquipmentSharingPolicy) {
		if (selectedItem) {
			this.selectEquipmentSharingPolicy({
				isSelected: true,
				data: selectedItem
			});
		}
		const dialog = this.dialogService.open(
			EquipmentSharingPolicyMutationComponent,
			{
				context: {
					equipmentSharingPolicy: this.selectedEquipmentSharingPolicy,
					selectedOrganization: this.selectedOrganization
				}
			}
		);
		const equipmentSharingPolicy = await dialog.onClose
			.pipe(first())
			.toPromise();
		this.selectedEquipmentSharingPolicy = null;
		this.disableButton = true;

		if (equipmentSharingPolicy) {
			this.toastrService.primary(
				this.getTranslation(
					'EQUIPMENT_SHARING_POLICY_PAGE.REQUEST_SAVED'
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}

		this.loadSettings();
	}

	async delete(selectedItem?: IEquipmentSharing) {
		if (selectedItem) {
			this.selectEquipmentSharingPolicy({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.equipmentSharingPolicyService.delete(
				this.selectedEquipmentSharingPolicy.id
			);
			this.loadSettings();
			this.toastrService.primary(
				this.getTranslation(
					'EQUIPMENT_SHARING_POLICY_PAGE.REQUEST_DELETED'
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.disableButton = true;
	}

	async selectEquipmentSharingPolicy({ isSelected, data }) {
		const selectedEquipmentSharingPolicy = isSelected ? data : null;
		if (this.equipmentSharingPolicyTable) {
			this.equipmentSharingPolicyTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedEquipmentSharingPolicy = selectedEquipmentSharingPolicy;
	}

	async loadSettings() {
		this.selectedEquipmentSharingPolicy = null;
		let findInput: IEquipmentSharingPolicy = {};
		let policies = [];
		if (this.selectedOrganization) {
			const { id: organizationId, tenantId } = this.selectedOrganization;
			findInput = {
				organizationId,
				tenantId
			};
		}

		policies = (
			await this.equipmentSharingPolicyService.getAll(
				['organization'],
				findInput
			)
		).items;

		this.loading = false;
		this.equipmentSharingPolicyData = policies;
		this.smartTableSource.load(policies);
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

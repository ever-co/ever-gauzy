import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { UntypedFormGroup } from '@angular/forms';
import { NbDialogService } from '@nebular/theme';
import { filter, tap } from 'rxjs/operators';
import { firstValueFrom, Subject, debounceTime } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ServerDataSource, ToastrService } from '@gauzy/ui-sdk/core';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { IEquipmentSharing, ComponentLayoutStyleEnum, IEquipmentSharingPolicy, IOrganization } from '@gauzy/contracts';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { EquipmentSharingPolicyService, Store } from '../../@core/services';
import { API_PREFIX, ComponentEnum } from '@gauzy/ui-sdk/common';
import { EquipmentSharingPolicyMutationComponent } from '../../@shared/equipment-sharing-policy';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from '../../@shared/pagination/pagination-filter-base.component';
import { InputFilterComponent } from '../../@shared/table-filters';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './equipment-sharing-policy.component.html',
	styleUrls: ['./equipment-sharing-policy.component.scss']
})
export class EquipmentSharingPolicyComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading: boolean;
	selectedEquipmentSharingPolicy: IEquipmentSharingPolicy;
	smartTableSource: ServerDataSource;
	form: UntypedFormGroup;
	disableButton = true;
	equipmentSharingPolicyData: IEquipmentSharingPolicy[];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	selectedOrganization: IOrganization;
	equipmentSharingPolicy$: Subject<boolean> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

	constructor(
		readonly translateService: TranslateService,
		private readonly equipmentSharingPolicyService: EquipmentSharingPolicyService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly httpClient: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.equipmentSharingPolicy$
			.pipe(
				debounceTime(100),
				tap(() => this.clearItem()),
				tap(() => this.loadEquipmentSharingPolicies()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.equipmentSharingPolicy$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.selectedOrganization = organization)),
				tap(() => this._refresh$.next(true)),
				tap(() => this.equipmentSharingPolicy$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.equipmentSharingPolicyData = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.EQUIPMENT_SHARING_POLICY;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.equipmentSharingPolicyData = [])),
				tap(() => this.equipmentSharingPolicy$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async loadSmartTable() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			editable: true,
			selectedRowIndex: -1,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.EQUIPMENT_SHARING_POLICY'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			},
			columns: {
				name: {
					title: this.getTranslation('EQUIPMENT_SHARING_POLICY_PAGE.EQUIPMENT_SHARING_POLICY_NAME'),
					type: 'string',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (name: string) => {
						this.setFilter({ field: 'name', search: name });
					}
				},
				description: {
					title: this.getTranslation('EQUIPMENT_SHARING_POLICY_PAGE.EQUIPMENT_SHARING_POLICY_DESCRIPTION'),
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
		const dialog = this.dialogService.open(EquipmentSharingPolicyMutationComponent, {
			context: {
				equipmentSharingPolicy: this.selectedEquipmentSharingPolicy,
				selectedOrganization: this.selectedOrganization
			}
		});
		const equipmentSharingPolicy = await firstValueFrom(dialog.onClose);
		this.selectedEquipmentSharingPolicy = null;
		this.disableButton = true;

		if (equipmentSharingPolicy) {
			this.toastrService.success('EQUIPMENT_SHARING_POLICY_PAGE.MESSAGES.EQUIPMENT_REQUEST_SAVED', {
				name: equipmentSharingPolicy.name
			});
			this._refresh$.next(true);
			this.equipmentSharingPolicy$.next(true);
		}

		this.clearItem();
	}

	async delete(selectedItem?: IEquipmentSharing) {
		if (selectedItem) {
			this.selectEquipmentSharingPolicy({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose);

		if (result) {
			await this.equipmentSharingPolicyService.delete(this.selectedEquipmentSharingPolicy.id);
			this._refresh$.next(true);
			this.equipmentSharingPolicy$.next(true);
			this.clearItem();
			this.toastrService.success('EQUIPMENT_SHARING_POLICY_PAGE.MESSAGES.EQUIPMENT_REQUEST_DELETED', {
				name: this.selectedEquipmentSharingPolicy.name
			});
		}
	}

	async selectEquipmentSharingPolicy({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedEquipmentSharingPolicy = isSelected ? data : null;
	}

	setSmartTableSource() {
		if (!this.selectedOrganization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.selectedOrganization;
		this.loading = true;
		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/equipment-sharing-policy/pagination`,
			relations: ['organization'],
			where: {
				...{ organizationId, tenantId },
				...this.filters.where
			},
			finalize: () => {
				if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
					this.equipmentSharingPolicyData.push(...this.smartTableSource.getData());
				}
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	private async loadEquipmentSharingPolicies() {
		if (!this.selectedOrganization) {
			return;
		}
		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.loadSmartTable();
		});
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectEquipmentSharingPolicy({
			isSelected: false,
			data: null
		});
	}

	ngOnDestroy() {}
}

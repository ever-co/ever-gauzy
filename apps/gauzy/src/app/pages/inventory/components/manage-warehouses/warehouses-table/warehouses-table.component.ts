import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { ComponentLayoutStyleEnum } from '@gauzy/contracts';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { first, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { WarehouseService } from 'apps/gauzy/src/app/@core/services/warehouse.service';
import { DeleteConfirmationComponent } from 'apps/gauzy/src/app/@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ComponentEnum } from 'apps/gauzy/src/app/@core/constants/layout.constants';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-warehouses',
	templateUrl: './warehouses-table.component.html',
	styleUrls: ['./warehouses-table.component.scss']
})
export class WarehousesTableComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading: boolean;
	selectedWarehouse: any;
	smartTableSource = new LocalDataSource();
	warehousesList = [];
	disableButton = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;

	warehousesTable: Ng2SmartTableComponent;
	@ViewChild('warehousesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.warehousesTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		readonly translateService: TranslateService,
		private dialogService: NbDialogService,
		private warehouseService: WarehouseService,
		private toastrService: ToastrService,
		private router: Router,
		private store: Store
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.loadSmartTable();
		this.loadSettings();
	}

	setView() {
		this.viewComponentName = ComponentEnum.WAREHOUSE;
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
		this.warehousesTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	// title: this.getTranslation('INVENTORY_PAGE.NAME'),
	// type: 'string',
	// width: '40%'

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				// logo: {
				// 	title: this.getTranslation('INVENTORY_PAGE.LOGO'),
				// 	type: 'custom'
				// },
				description: {
					title: this.getTranslation('INVENTORY_PAGE.DESCRIPTION'),
					type: 'string'
				},
				name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'),
					type: 'string'
				},
				email: {
					title: this.getTranslation('INVENTORY_PAGE.EMAIL'),
					type: 'string'
				},
				address: {
					title: this.getTranslation('INVENTORY_PAGE.ADDRESS'),
					type: 'string'
				},
				active: {
					title: this.getTranslation('INVENTORY_PAGE.ACTIVE'),
					type: 'boolean'
				}
			}
		};
	}

	async loadSettings() {
		const warehousesResult = await this.warehouseService.getAll();

		if (!warehousesResult || !warehousesResult.items) return;

		this.warehousesList = warehousesResult.items;
		this.smartTableSource.load(warehousesResult.items);
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	onCreateWarehouse() {
		this.router.navigate([
			'/pages/organization/inventory/warehouses/create'
		]);
	}

	async delete() {
		let res = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (res) {
			await this.warehouseService
				.deleteFeaturedImage(this.selectedWarehouse.id)
				.then((res) => {
					//tstodo
					if (res && res.affected == 1) {
						this.toastrService.success(
							'INVENTORY_PAGE.WAREHOUSE_DELETED',
							{
								name: this.selectedWarehouse.name
							}
						);

						this.loadSettings();
						this.clearItem();
					}
				})
				.catch((err) => {
					//tstodo
					this.toastrService.danger(
						'INVENTORY_PAGE.WAREHOUSE_DELETED'
					);
				});
		}
	}

	selectWarehouse({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedWarehouse = isSelected ? data : null;
	}

	clearItem() {
		this.selectWarehouse({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	deselectAll() {
		if (this.warehousesTable && this.warehousesTable.grid) {
			this.warehousesTable.grid.dataSet['willSelect'] = 'false';
			this.warehousesTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}
}

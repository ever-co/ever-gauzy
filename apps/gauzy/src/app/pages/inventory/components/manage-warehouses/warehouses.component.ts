import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import {
	IOrganization,
	IProductTypeTranslated,
	LanguagesEnum,
	ComponentLayoutStyleEnum
} from '@gauzy/contracts';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { ProductTypeService } from '../../../../@core/services/product-type.service';
import { NbDialogService } from '@nebular/theme';
import { first, tap } from 'rxjs/operators';
import { Store } from '../../../../@core/services/store.service';
import { ComponentEnum } from '../../../../@core/constants/layout.constants';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../../../@core/services/toastr.service';
import { WarehouseMutationComponent } from 'apps/gauzy/src/app/@shared/warehouse-mutation/warehouse-mutation.component';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-warehouses',
	templateUrl: './warehouses.component.html',
	styleUrls: ['./warehouses.component.scss']
})
export class WarehousesComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading: boolean;

	//tstodo
	selectedWarehouse: any;
	smartTableSource = new LocalDataSource();
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
		private productTypeService: ProductTypeService,
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
		this.viewComponentName = ComponentEnum.PRODUCT_TYPE;
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
			columns: {
				//tstodo
				// logo: {
				// 	title: this.getTranslation('INVENTORY_PAGE.LOGO'),
				// 	type: 'string'
				// },
				description: {
					title: this.getTranslation('INVENTORY_PAGE.DESCRIPTION'),
					type: 'string'
				},
				name: {
					title: this.getTranslation('INVENTORY_PAGE.TITLE'),
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
		//tstodo
		const data = [
			{
				description: '',
				active: true,
				address: 'hjkl',
				code: 'jkl',
				name: 'name',
				logo: '',
				email: 'test@abv.gh',
				tags: [{}]
			}
		];

		this.smartTableSource.load(data);
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	async save(warehouse?: any) {
		const dialog = this.dialogService.open(WarehouseMutationComponent, {
			context: {
				// warehouse: editWarehouse
			}
		});

		const result = await dialog.onClose.pipe(first()).toPromise();
	}

	async delete(selectedItem?: any) {}

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

import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { API_PREFIX } from 'apps/gauzy/src/app/@core';
import { ServerDataSource } from 'ng2-smart-table';
import {
	IProductStore,
	ComponentLayoutStyleEnum
} from '@gauzy/contracts';
import { first, tap } from 'rxjs/operators';
import { ComponentEnum } from '../../../../../@core/constants/layout.constants';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-product-store-table',
	templateUrl: './product-store-table.component.html',
	styleUrls: ['./product-store-table.component.scss']
})
export class ProductStoreTableComponent
	extends TranslationBaseComponent
	implements OnInit {

	settingsSmartTable: object;
	loading: boolean;
	selectedStore: IProductStore;
	source = ServerDataSource;
	STORES_URL = `${API_PREFIX}/product-stores/`;
	viewComponentName: ComponentEnum;

	disableButton = true;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;


	storesTable: Ng2SmartTableComponent;
	@ViewChild('productStore') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.storesTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		readonly translateService: TranslateService,
		private router: Router,
		private http: HttpClient,
		private toastrService: ToastrService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.loadSmartTable();
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			pager: {
				perPage: 10
			},
			columns: {
				name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'),
					type: 'string',
				},
				description: {
					title: this.getTranslation('INVENTORY_PAGE.DESCRIPTION'),
					type: 'string',
					filter: false,
					valuePrepareFunction: (description: string) => {
						return description
							? description.slice(0, 15) + '...'
							: '';
					}
				},
			},

		}
	}

	onAddStoreClick() {
		this.router.navigate(['/pages/organization/inventory/stores/create']);
	}

	onEditStore(selectedItem) {

	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.storesTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectStore({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.storesTable && this.storesTable.grid) {
			this.storesTable.grid.dataSet['willSelect'] = 'false';
			this.storesTable.grid.dataSet.deselectAll();
		}
	}

	async selectStore({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedStore = isSelected ? data : null;
	}



}

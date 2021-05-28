import { Component, OnInit, ViewChild } from '@angular/core';
import { ComponentLayoutStyleEnum, IWarehouse } from '@gauzy/contracts';
import { Ng2SmartTableComponent, ServerDataSource } from 'ng2-smart-table';
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
import { ItemImgTagsComponent } from '../../table-components/item-img-tags-row.component';
import { EnabledStatusComponent } from '../../table-components/enabled-row.component';
import { HttpClient } from '@angular/common/http';
import { API_PREFIX } from '../../../../../@core';
import { ContactRowComponent } from '../../table-components/contact-row.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-warehouses',
	templateUrl: './warehouses-table.component.html',
	styleUrls: ['./warehouses-table.component.scss']
})
export class WarehousesTableComponent
	extends TranslationBaseComponent
	implements OnInit {
	settingsSmartTable: object;
	loading: boolean;
	selectedWarehouse: IWarehouse;
	smartTableSource: ServerDataSource;
	warehousesList: IWarehouse[] = [];
	disableButton: boolean = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	STORES_URL = `${API_PREFIX}/warehouses?`;

	totalItems = 0;
	currentPage = 1;
	itemsPerPage = 10;

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
		private store: Store,
		private http: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.loadSmartTable();
		this.loadSettings();


		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization || { id: null };

		this.warehouseService.count({ findInput: { organizationId, tenantId } }).then(res => {
			this.totalItems = res as any;
		});
	}

	setView() {
		this.viewComponentName = ComponentEnum.WAREHOUSE;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;

				
				if (componentLayout == ComponentLayoutStyleEnum.CARDS_GRID) {
					this.onPageChange(this.currentPage);
				}

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

	async loadSettings() {
		this.settingsSmartTable = {
			actions: false,
			pager: {
				perPage: this.itemsPerPage
			},
			columns: {
				name: {
					title: this.getTranslation('INVENTORY_PAGE.LOGO'),
					type: 'custom',
					renderComponent: ItemImgTagsComponent
				},
				email: {
					title: this.getTranslation('INVENTORY_PAGE.EMAIL'),
					type: 'string'
				},
				contact: {
					title: this.getTranslation('INVENTORY_PAGE.CONTACT'),
					type: 'custom',
					renderComponent: ContactRowComponent
				},
				description: {
					title: this.getTranslation('INVENTORY_PAGE.DESCRIPTION'),
					type: 'string'
				},
				active: {
					title: this.getTranslation('INVENTORY_PAGE.ACTIVE'),
					type: 'custom',
					renderComponent: EnabledStatusComponent
				}
			}
		};
	}


	async loadSmartTable() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization || { id: null };

		const data = "data=" + JSON.stringify({
			relations: ['logo'],
			findInput: {
				organization: { id: organizationId },
				tenantId
			},
		});

		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: this.STORES_URL + data,
			dataKey: 'items',
			totalKey: 'total',
			perPage: 'per_page',
			pagerPageKey: 'page'
		});
		this.loading = false;
	}

	onPageChange(pageNum: number) {
		this.currentPage = pageNum;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization || { id: null };

		const options = {
			relations: ['logo'],
			findInput: { organizationId, tenantId }
		};

		this.warehouseService.getAll(options,
			{ page: pageNum, _limit: this.itemsPerPage }).then(res => {
				if (res && res.items) {
					this.warehousesList = res.items;
				}
			});
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

	onUpdateWarehouse() {
		this.router.navigate([
			'/pages/organization/inventory/warehouses/edit/' +
				this.selectedWarehouse?.id
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
					if (res && res.affected == 1) {
						this.toastrService.success(
							'INVENTORY_PAGE.WAREHOUSE_WAS_CREATED',
							{
								name: this.selectedWarehouse.name
							}
						);

						this.loadSettings();
						this.clearItem();
					}
				})
				.catch((err) => {
					this.toastrService.danger(
						'INVENTORY_PAGE.WAREHOUSE_WAS_DELETED',
						this.selectedWarehouse.name
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

}

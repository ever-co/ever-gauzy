import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Ng2SmartTableComponent, ServerDataSource } from 'ng2-smart-table';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';
import { API_PREFIX } from 'apps/gauzy/src/app/@core';
import {
	IMerchant,
	IOrganization,
	ComponentLayoutStyleEnum,
	IContact
} from '@gauzy/contracts';
import { tap } from 'rxjs/operators';
import { ComponentEnum } from '../../../../../@core/constants/layout.constants';
import { Router } from '@angular/router';
import { MerchantService } from '../../../../../@core/services/merchant.service';
import { Store } from '../../../../../@core/services/store.service';
import { EnabledStatusComponent } from '../../table-components/enabled-row.component';
import { ItemImgTagsComponent } from '../../table-components/item-img-tags-row.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-merchant-table',
	templateUrl: './merchant-table.component.html',
	styleUrls: ['./merchant-table.component.scss']
})
export class MerchantTableComponent
	extends TranslationBaseComponent
	implements OnInit {

	settingsSmartTable: object;
	loading: boolean;
	selectedMerchant: IMerchant;
	source: ServerDataSource;
	STORES_URL = `${API_PREFIX}/merchants?`;

	disableButton = true;
	viewComponentName: ComponentEnum.MERCHANTS;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	selectedOrganization: IOrganization;

	merchantsTable: Ng2SmartTableComponent;
	merchantData: IMerchant[] = [];
	totalItems = 0;
	currentPage = 1;
	itemsPerPage = 10;

	@ViewChild('productStore') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.merchantsTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		readonly translateService: TranslateService,
		private router: Router,
		private http: HttpClient,
		private toastrService: ToastrService,
		private merchantService: MerchantService,
		private store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.setView();
		this.loadSettings();
		this.loadSmartTable();

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization || { id: null };

		this.merchantService.count({ findInput: { organizationId, tenantId } }).then(res => {
			this.totalItems = res as any;
		});

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((org) => {
				this.selectedOrganization = org;
				if (this.selectedOrganization) {
					this.loadSettings();
				}
			});

	}

	setView() {
		this.viewComponentName = ComponentEnum.MERCHANTS;
		this.store
			.componentLayout$(ComponentEnum.MERCHANTS)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;

				if (componentLayout == ComponentLayoutStyleEnum.CARDS_GRID) {
					this.onPageChange(this.currentPage);
				}
			});
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			pager: {
				perPage: this.itemsPerPage
			},
			columns: {
				name: {
					title: this.getTranslation('INVENTORY_PAGE.NAME'),
					type: 'custom',
					renderComponent: ItemImgTagsComponent
				},
				code: {
					title: this.getTranslation('INVENTORY_PAGE.CODE'),
					type: 'string',
				},
				contact: {
					title: this.getTranslation('INVENTORY_PAGE.CONTACT'),
					type: 'string',
					valuePrepareFunction: (contact: IContact, row) => {

						if (!contact) return '-';

						return `${this.getTranslation(
							'INVENTORY_PAGE.COUNTRY'
						)}: ${contact.country || '-'}, ${this.getTranslation(
							'INVENTORY_PAGE.CITY'
						)}:${contact.city || '-'}, ${this.getTranslation(
							'INVENTORY_PAGE.ADDRESS'
						)}: ${contact.address || '-'}, ${this.getTranslation(
							'INVENTORY_PAGE.ADDRESS'
						)} 2: ${contact.address2 || '-'}`;
					}
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
				active: {
					title: this.getTranslation('INVENTORY_PAGE.ACTIVE'),
					type: 'custom',
					renderComponent: EnabledStatusComponent
				}
			},

		}
	}

	onPageChange(pageNum) {
		this.currentPage = pageNum;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization || { id: null };

		const options = {
			relations: ['logo', 'contact', 'tags', 'warehouses'],
			findInput: { organizationId, tenantId }
		};

		this.merchantService.getAll(options,
			{ page: pageNum, _limit: this.itemsPerPage }).then(res => {
				if (res && res.items) {
					this.merchantData = res.items;
				}
			});
	}

	onAddStoreClick() {
		this.router.navigate(['/pages/organization/inventory/merchants/create']);
	}

	onEditStore(selectedItem) {
		this.router.navigate([`/pages/organization/inventory/merchants/edit/${this.selectedMerchant.id}`]);
	}

	async loadSettings() {
		const { id: organizationId, tenantId } = this.selectedOrganization || { id: null, tenantId: null };


		const data = "data=" + JSON.stringify({
			relations: ['logo', 'contact', 'tags', 'warehouses'],
			findInput: {
				organization: { id: organizationId },
				tenantId
			},
		});

		this.source = new ServerDataSource(this.http, {
			endPoint: this.STORES_URL + data,
			dataKey: 'items',
			totalKey: 'total',
			perPage: 'per_page',
			pagerPageKey: 'page'
		});
		this.loading = false;
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.merchantsTable.source.onChangedSource
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
		if (this.merchantsTable && this.merchantsTable.grid) {
			this.merchantsTable.grid.dataSet['willSelect'] = 'false';
			this.merchantsTable.grid.dataSet.deselectAll();
		}
	}

	async selectStore({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedMerchant = isSelected ? data : null;
	}

	async delete() {
		this.merchantService.delete(this.selectedMerchant.id)
			.then(res => {
				if (res && res['affected'] == 1) {
					this.toastrService.success(
						'INVENTORY_PAGE.MERCHANT_DELETED_SUCCESSFULLY',
						{ name: this.selectedMerchant.name }
					);

				}
				this.loadSettings();
			});
	}


}

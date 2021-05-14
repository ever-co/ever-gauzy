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
import { MerchantService } from '../../../../../@core/services/product-store.service';
import { Store } from '../../../../../@core/services/store.service';
import { EnabledStatusComponent } from '../../table-components/enabled-row.component';

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
	STORES_URL = `${API_PREFIX}/product-stores?`;
	viewComponentName: ComponentEnum;

	disableButton = true;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	selectedOrganization: IOrganization;

	merchantsTable: Ng2SmartTableComponent;

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
		private productStoreService: MerchantService,
		private store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.loadSettings();
		this.loadSmartTable();

		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((org) => {
				this.selectedOrganization = org;
				if (this.selectedOrganization) {
					this.loadSettings();
				}
			});

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
				code: {
					title: this.getTranslation('INVENTORY_PAGE.CODE'),
					type: 'string',
				},
				contact: {
					title: this.getTranslation('INVENTORY_PAGE.CONTACT'),
					type: 'string',
					valuePrepareFunction: (contact: IContact, row) => {

						if(!contact) return '-';

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

	onAddStoreClick() {
		this.router.navigate(['/pages/organization/inventory/stores/create']);
	}

	onEditStore(selectedItem) {

	}

	async loadSettings() {
		const { id: organizationId, tenantId } = this.selectedOrganization;

		
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



}

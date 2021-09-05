import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest } from 'rxjs';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { NbDialogService } from '@nebular/theme';
import { distinctUntilChange } from '@gauzy/common-angular';
import {
	IMerchant,
	IOrganization,
	ComponentLayoutStyleEnum,
	IContact,
	IWarehouse
} from '@gauzy/contracts';
import { API_PREFIX, ComponentEnum } from './../../../../../@core/constants';
import { MerchantService, Store, ToastrService } from '../../../../../@core/services';
import { EnabledStatusComponent, ItemImgTagsComponent } from '../../table-components';
import { PaginationFilterBaseComponent } from './../../../../../@shared/pagination/pagination-filter-base.component';
import { ServerDataSource } from './../../../../../@core/utils/smart-table/server.data-source';
import { DeleteConfirmationComponent } from './../../../../../@shared/user/forms';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-merchant-table',
	templateUrl: './merchant-table.component.html',
	styleUrls: ['./merchant-table.component.scss']
})
export class MerchantTableComponent
	extends PaginationFilterBaseComponent
	implements OnInit {

	settingsSmartTable: object;
	loading: boolean;
	selectedMerchant: IMerchant;
	smartTableSource: ServerDataSource;
	merchants: IMerchant[] = [];
	disableButton: boolean = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	public organization: IOrganization;
	merchants$: Subject<any> = this.subject$;

	merchantsTable: Ng2SmartTableComponent;
	@ViewChild('merchantsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.merchantsTable = content;
			this.onChangedSource();
		}
	}

	/*
	* Actions Buttons directive 
	*/
	@ViewChild('actionButtons', { static : true }) actionButtons : TemplateRef<any>;

	constructor(
		public readonly translateService: TranslateService,
		private readonly router: Router,
		private readonly http: HttpClient,
		private readonly toastrService: ToastrService,
		private readonly merchantService: MerchantService,
		private readonly store: Store,
		private readonly dialogService: NbDialogService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
	}

	ngAfterViewInit(): void {
		this.merchants$
			.pipe(
				debounceTime(300),
				tap(() => this.loading = true),
				tap(() => this.getMerchants()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();

		const storeOrganization$ = this.store.selectedOrganization$;
		combineLatest([storeOrganization$])
			.pipe(
				debounceTime(300),
				filter(([organization]) => !!organization),
				tap(([organization]) => (this.organization = organization)),
				distinctUntilChange(),
				tap(() => this.merchants$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.MERCHANTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => this.merchants$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			pager: {
				perPage: this.pagination.itemsPerPage
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
			}
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onAddStoreClick() {
		this.router.navigate([
			'/pages/organization/inventory/merchants/create'
		]);
	}

	onEditStore(selectedItem?: IMerchant) {
		if (selectedItem) {
			this.selectStore({
				isSelected: true,
				data: selectedItem
			});
		}

		this.router.navigate([
			`/pages/organization/inventory/merchants/edit`, 
			this.selectedMerchant.id
		]);
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

	async onDelete(selectedItem?: IMerchant) {
		if (selectedItem) {
			this.selectStore({
				isSelected: true,
				data: selectedItem
			});
		}
		if (!this.selectedMerchant) {
			return;
		}

		const dialog = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (dialog) {
			await this.merchantService
				.delete(this.selectedMerchant.id)
				.then(res => {
					if (res && res['affected'] == 1) {
						const { name } = this.selectedMerchant;
						this.toastrService.success('INVENTORY_PAGE.MERCHANT_DELETED_SUCCESSFULLY', {
							name
						});
					}
				})
				.finally(() => {
					this.merchants$.next();
				});
		}
	}

	/*
	* Register Smart Table Source Config 
	*/
	setSmartTableSource() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.http, {
			endPoint: `${API_PREFIX}/merchants/pagination`,
			relations: [ 'logo', 'contact', 'tags', 'warehouses' ],
			where: {
				...{ organizationId, tenantId },
				...this.filters.where
			},
			resultMap: (warehouse: IWarehouse) => {
				return Object.assign({}, warehouse);
			},
			finalize: () => {
				this.loading = false;
			}
		});
	}

	/**
	 * GET merchants smart table source
	 */
	 private async getMerchants() {
		try { 
			this.setSmartTableSource();
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {

				// Initiate GRID view pagination
				const { activePage, itemsPerPage } = this.pagination;
				this.smartTableSource.setPaging(activePage, itemsPerPage, false);

				await this.smartTableSource.getElements();
				this.merchants = this.smartTableSource.getData();

				this.pagination['totalItems'] =  this.smartTableSource.count();
			}
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	selectStore({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedMerchant = isSelected ? data : null;
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
}

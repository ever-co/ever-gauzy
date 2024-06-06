import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { LocalDataSource } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest } from 'rxjs';
import { IImageAsset, IProductOptionTranslatable, IProductTranslatable, LanguagesEnum } from '@gauzy/contracts';
import { ProductService, TranslatableService } from '@gauzy/ui-sdk/core';
import { GalleryComponent, GalleryService } from './../../../../@shared/gallery';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { EnabledStatusComponent, ImageRowComponent } from '../inventory-table-components';
import { Store } from '@gauzy/ui-sdk/common';

@UntilDestroy()
@Component({
	selector: 'ngx-view-inventory-item',
	templateUrl: './view-inventory-item.component.html',
	styleUrls: ['./view-inventory-item.component.scss']
})
export class InventoryItemViewComponent extends TranslationBaseComponent implements OnInit {
	inventoryItem: IProductTranslatable;
	loading: boolean = true;
	options: IProductOptionTranslatable[] = [];

	@ViewChild('variantTable') variantTable;

	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();

	constructor(
		public readonly translateService: TranslateService,
		private readonly translatableService: TranslatableService,
		private readonly productService: ProductService,
		private readonly route: ActivatedRoute,
		private readonly store: Store,
		private readonly galleryService: GalleryService,
		private readonly nbDialogService: NbDialogService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		combineLatest([this.route.params, this.store.preferredLanguage$])
			.pipe(untilDestroyed(this))
			.subscribe(async ([params, languageCode]) => {
				this.inventoryItem = await this.productService.getById(params.id, [
					'productCategory',
					'productType',
					'optionGroups',
					'variants',
					'tags',
					'gallery',
					'featuredImage'
				]);
				let variants = [];

				if (this.inventoryItem && this.inventoryItem.variants) {
					variants = this.inventoryItem.variants.map((variant) => {
						return {
							...variant,
							...variant.setting,
							...variant.price
						};
					});
				}

				if (this.inventoryItem && this.inventoryItem.optionGroups) {
					this.options = [];
					this.inventoryItem.optionGroups.forEach((optionGroup) => {
						this.options.push(...optionGroup.options);
					});
				}

				this.options.map((option) => {
					let currentTranslation = option.translations.find((translation) => {
						return (
							translation.languageCode == languageCode ||
							translation.languageCode == LanguagesEnum.ENGLISH
						);
					});

					if (currentTranslation) {
						option.name = currentTranslation.name;
					} else {
						option.name = '-';
					}
				});

				this.loading = false;
				this.loadSmartTable();
				this.smartTableSource.load(variants);
			});
	}

	onGalleryItemClick(galleryItem: IImageAsset) {
		const mappedImages = this.inventoryItem.gallery.map((image) => {
			return {
				thumbUrl: image.fullUrl,
				fullUrl: image.fullUrl
			};
		});

		this.galleryService.appendItems(mappedImages);

		this.nbDialogService.open(GalleryComponent, {
			context: {
				items: mappedImages,
				item: mappedImages.find((image) => image.thumbUrl == galleryItem.fullUrl)
			},
			dialogClass: 'fullscreen'
		});
	}

	getTranslatedProp(item: any, prop: string) {
		return this.translatableService.getTranslatedProperty(item, prop);
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			hideSubHeader: true,
			columns: {
				image: {
					title: this.getTranslation('INVENTORY_PAGE.IMAGE'),
					type: 'custom',
					renderComponent: ImageRowComponent,
					filter: false
				},
				options: {
					title: this.getTranslation('INVENTORY_PAGE.OPTIONS'),
					type: 'string',
					valuePrepareFunction: (_, variant) => {
						return variant.options && variant.options.length > 0
							? variant.options.map((option) => option.name).join(', ')
							: this.getTranslation('INVENTORY_PAGE.NO_OPTIONS_LABEL');
					},
					filter: false
				},
				internalReference: {
					title: this.getTranslation('INVENTORY_PAGE.CODE'),
					type: 'string',
					filter: false
				},
				quantity: {
					title: this.getTranslation('INVENTORY_PAGE.QUANTITY'),
					type: 'string',
					filter: false
				},
				price: {
					title: this.getTranslation('INVENTORY_PAGE.PRICE'),
					type: 'number',
					valuePrepareFunction: (_, price) => {
						return `${_.unitCostCurrency} ${_.unitCost}`;
					},
					filter: false
				},
				isEquipment: {
					title: this.getTranslation('INVENTORY_PAGE.IS_EQUIPMENT'),
					type: 'custom',
					renderComponent: EnabledStatusComponent,
					filter: false
				},
				canBePurchased: {
					title: this.getTranslation('INVENTORY_PAGE.CAN_BE_PURCHASED'),
					type: 'custom',
					renderComponent: EnabledStatusComponent,
					filter: false
				},
				notes: {
					title: this.getTranslation('INVENTORY_PAGE.NOTES'),
					type: 'string',
					filter: false
				},
				enabled: {
					title: this.getTranslation('INVENTORY_PAGE.ENABLED'),
					type: 'custom',
					renderComponent: EnabledStatusComponent,
					filter: false
				}
			}
		};
	}
}

import { Injectable } from '@angular/core';

import {
	IImageAsset,
	IProductOption,
	IProductTranslatable,
	IProductVariant,
	IProductOptionGroupTranslatable,
	IProductOptionTranslatable
} from '@gauzy/contracts';
import { NbTabComponent } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { VariantCreateInput } from '../../pages/inventory/components/edit-inventory-item/variant-form/variant-form.component';

@Injectable()
export class InventoryStore {
	private _activeProduct: IProductTranslatable = this.inventoryItemBlank;

	private _variantCreateInputs: VariantCreateInput[] = [];

	private _deleteOptions: IProductOptionTranslatable[] = [];

	private _optionGroups: IProductOptionGroupTranslatable[] = [];

	private _activeTab: NbTabComponent = null;

	activeProduct$: BehaviorSubject<IProductTranslatable> = new BehaviorSubject(
		this.activeProduct
	);

	variantCreateInputs$: BehaviorSubject<
		VariantCreateInput[]
	> = new BehaviorSubject(this.variantCreateInputs);

	optionGroups$: BehaviorSubject<
		IProductOptionGroupTranslatable[]
	> = new BehaviorSubject(this._optionGroups);

	deleteOptions$: BehaviorSubject<
		IProductOptionTranslatable[]
	> = new BehaviorSubject(this.deleteOptions);

	activeTab$: BehaviorSubject<NbTabComponent> = new BehaviorSubject(
		this.activeTab
	);

	constructor(private translateService: TranslateService) {}

	get activeProduct() {
		return this._activeProduct;
	}

	get gallery() {
		return this._activeProduct.gallery;
	}

	get featuredImage() {
		return this._activeProduct.featuredImage;
	}

	get storedVariants() {
		return this._activeProduct.variants;
	}

	get variantCreateInputs() {
		return this._variantCreateInputs;
	}

	get createoOptionCombinations() {
		return this._variantCreateInputs
			.filter((variant) => !variant.isStored)
			.map((variant) => ({ options: variant.options }));
	}

	get deleteOptions() {
		return this._deleteOptions;
	}

	get optionGroups() {
		return this._optionGroups;
	}

	get createOptionGroups() {
		return this._optionGroups.filter((optionGroup) => !optionGroup.id);
	}

	get activeTab() {
		return this._activeTab;
	}

	set activeProduct(product: IProductTranslatable) {
		this._activeProduct = { ...this.activeProduct, ...product };
		this.activeProduct$.next(this._activeProduct);
	}

	set variantCreateInputs(variantCreateInputs: VariantCreateInput[]) {
		this._variantCreateInputs = variantCreateInputs;
		this.variantCreateInputs$.next(this._variantCreateInputs);
	}

	set optionGroups(optionGroups: IProductOptionGroupTranslatable[]) {
		this._optionGroups = optionGroups;
		this.optionGroups$.next(this._optionGroups);
	}

	set activeTab(tab: NbTabComponent) {
		this._activeTab = tab;
		this.activeTab$.next(this._activeTab);
	}

	updateGallery(gallery: IImageAsset[]) {
		this.activeProduct.gallery = gallery;
		this.activeProduct$.next(this.activeProduct);
	}

	addGalleryImages(images: IImageAsset[]) {
		this.activeProduct.gallery.push(...images);
		this.activeProduct$.next(this.activeProduct);
	}

	deleteGalleryImage(image: IImageAsset) {
		this.activeProduct.gallery = this.activeProduct.gallery.filter(
			(img) => img.id !== image.id
		);

		if (
			this.activeProduct.featuredImage &&
			this.activeProduct.featuredImage.id == image.id
		) {
			this.activeProduct.featuredImage = null;
		}

		this.activeProduct$.next(this.activeProduct);
	}

	initVariantCreateInputs() {
		this._variantCreateInputs = this.activeProduct.variants.map(
			(variant: IProductVariant) => {
				return {
					options: variant.options.map(
						(option: IProductOption) => option.name
					),
					isStored: true,
					id: variant.id,
					productId: this.activeProduct.id
				};
			}
		);

		this.variantCreateInputs$.next(this._variantCreateInputs);
	}

	addVariantCreateInput(variantCreateInput: VariantCreateInput) {
		this._variantCreateInputs.push(variantCreateInput);
		this.variantCreateInputs$.next(this.variantCreateInputs);
	}

	updateVariantInputsOnDeletedOption(deletedOption: IProductOption) {
		let variantsUsingOption = this.variantCreateInputs.filter((variant) =>
			variant.options.find((option) => option == deletedOption.name)
		);

		variantsUsingOption.forEach((variant) => {
			variant.options = variant.options.filter(
				(option) => option != deletedOption.name
			);
		});

		this._variantCreateInputs = this.variantCreateInputs.filter(
			(variantCreateInput) => variantCreateInput.options.length
		);
		this.variantCreateInputs$.next(this._variantCreateInputs);
	}

	deleteVariant(variantDeleted: IProductVariant) {
		this.activeProduct.variants = this.activeProduct.variants.filter(
			(variant) => variant.id != variantDeleted.id
		);
		this.activeProduct$.next(this.activeProduct);
	}

	updateFeaturedImage(image: IImageAsset) {
		this.activeProduct.featuredImage = image;
		this.activeProduct$.next(this.activeProduct);
	}

	isFeaturedImage(image: IImageAsset) {
		if (!this.activeProduct.featuredImage) return false;

		return this.activeProduct.featuredImage.id == image.id;
	}

	clearCurrentProduct() {
		this.resetCreateVariants();
		this.activeProduct = this.inventoryItemBlank;
		this.activeProduct$.next(this.activeProduct);
	}

	addDeletedOption(productOption: IProductOptionTranslatable) {
		this._deleteOptions.push(productOption);
	}

	resetDeletedOptions() {
		this._deleteOptions = [];
		this.deleteOptions$.next(this._deleteOptions);
	}

	resetCreateVariants() {
		this.variantCreateInputs = [];
		this.variantCreateInputs$.next(this.variantCreateInputs);
	}

	get inventoryItemBlank() {
		return {
			tags: [],
			name: '',
			code: '',
			productTypeId: null,
			productCategoryId: null,
			enabled: true,
			description: '',
			languageCode: this.translateService.currentLang,
			variants: [],
			options: [],
			featuredImage: null,
			gallery: [],
			id: null
		};
	}
}

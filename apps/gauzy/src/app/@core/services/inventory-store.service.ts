import { Injectable } from '@angular/core';

import {
	IImageAsset,
	IProductOption,
	IProductTranslatable,
	IProductVariant,
	IVariantOptionCombination
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import { VariantCreateInput } from '../../pages/inventory/components/edit-inventory-item/variant-form/variant-form.component';

@Injectable()
export class InventoryStore {
	private _activeProduct: IProductTranslatable = this.inventoryItemBlank;

	private _varintCreateInputs: VariantCreateInput[] = [];
	private _optionsCombinations: IVariantOptionCombination[] = [];
	private _deleteOptions: IProductOption[] = [];

	activeProduct$: BehaviorSubject<IProductTranslatable> = new BehaviorSubject(
		this.activeProduct
	);

	variantCreateInputs$: BehaviorSubject<
		VariantCreateInput[]
	> = new BehaviorSubject(this.variantCreateInputs);

	optionsCombinations$: BehaviorSubject<
		IVariantOptionCombination[]
	> = new BehaviorSubject(this.optionsCombinations);

	deleteOptions$: BehaviorSubject<IProductOption[]> = new BehaviorSubject(
		this.deleteOptions
	);

	createOptions$: BehaviorSubject<IProductOption[]> = new BehaviorSubject(
		this.createOptions
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
		return this._varintCreateInputs;
	}

	get optionsCombinations() {
		return this._optionsCombinations;
	}

	get createoOptionCombinations() {
		return this._varintCreateInputs
			.filter((variant) => !variant.isStored)
			.map((variant) => ({ options: variant.options }));
	}

	get deleteOptions() {
		return this._deleteOptions;
	}

	get createOptions() {
		return this.activeProduct.options;
	}

	set activeProduct(product: IProductTranslatable) {
		this._activeProduct = { ...this.activeProduct, ...product };
		this.activeProduct$.next(this._activeProduct);
	}

	set variantCreateInputs(variantCreateInput: VariantCreateInput[]) {
		this._varintCreateInputs = variantCreateInput;
		this.variantCreateInputs$.next(this._varintCreateInputs);
	}

	set optionsCombinations(optionsCombinations: IVariantOptionCombination[]) {
		this._optionsCombinations = optionsCombinations;
		this.optionsCombinations$.next(optionsCombinations);
	}

	set options(options: IProductOption[]) {
		this.activeProduct.options = options;
		this.activeProduct$.next(this.activeProduct);
	}

	updateGallery(gallery: IImageAsset[]) {
		this.activeProduct.gallery = gallery;
		this.activeProduct$.next(this.activeProduct);
	}

	addGalleryImage(image: IImageAsset) {
		this.activeProduct.gallery.push(image);
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

	deleteOption(optionDeleted: IProductOption) {
		this._deleteOptions.push(optionDeleted);
		this._activeProduct.options = this.activeProduct.options.filter(
			(option) =>
				option.name !== optionDeleted.name &&
				option.code !== optionDeleted.code
		);
		this.deleteOptions$.next(this._deleteOptions);
		this.activeProduct$.next(this._activeProduct);
	}

	clearCurrentProduct() {
		this.activeProduct = this.inventoryItemBlank;
		this.activeProduct$.next(this.activeProduct);
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

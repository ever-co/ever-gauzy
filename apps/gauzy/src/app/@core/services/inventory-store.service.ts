import { Injectable } from '@angular/core';

import { IImageAsset, IProductTranslatable } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class InventoryStore {
	private _activeProduct: IProductTranslatable = this.inventoryItemBlank;

	activeProduct$: BehaviorSubject<IProductTranslatable> = new BehaviorSubject(
		this.activeProduct
	);

	constructor(private translateService: TranslateService) {}

	get activeProduct() {
		return this._activeProduct;
	}

	get gallery() {
		return this._activeProduct.gallery;
	}

	get featuredImage() {
		return this.activeProduct.featuredImage;
	}

	set activeProduct(product: IProductTranslatable) {
		this._activeProduct = { ...this.activeProduct, ...product };
		this.activeProduct$.next(this._activeProduct);
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

	updateFeaturedImage(image: IImageAsset) {
		this.activeProduct.featuredImage = image;
		this.activeProduct$.next(this.activeProduct);
	}

	isFeaturedImage(image: IImageAsset) {
		if (!this.activeProduct.featuredImage) return false;

		return this.activeProduct.featuredImage.id == image.id;
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
			gallery: [],
			id: null
		};
	}
}

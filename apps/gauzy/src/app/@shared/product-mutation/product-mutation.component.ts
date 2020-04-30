import { Component } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { Product, ProductVariant } from '@gauzy/models';
import { FormGroup } from '@angular/forms';
import { ProductService } from '../../@core/services/product.service';
import { ProductVariantService } from '../../@core/services/product-variant.service';
import { ProductVariantSettingsService } from '../../@core/services/product-variant-settings.service';
import { ProductVariantPriceService } from '../../@core/services/product-variant-price.service';

@Component({
	selector: 'ngx-product-mutation',
	templateUrl: './product-mutation.component.html',
	styleUrls: ['./product-mutation.component.scss']
})
export class ProductMutationComponent extends TranslationBaseComponent {
	form: FormGroup;
	product: Product;
	editProductVariant: ProductVariant;
	edit = 'product';

	constructor(
		readonly translationService: TranslateService,
		private toastrService: NbToastrService,
		public dialogRef: NbDialogRef<ProductMutationComponent>,
		private productService: ProductService,
		private productVariantService: ProductVariantService,
		private productVariantPriceService: ProductVariantPriceService,
		private productVariantSettingsService: ProductVariantSettingsService
	) {
		super(translationService);
	}

	async onSaveProduct(productRequest: Product) {
		if (!productRequest.id) {
			this.product = await this.productService.create(productRequest);
			this.product.variants = await this.productVariantService.createProductVariants(
				this.product
			);
		} else {
			this.product = await this.productService.update(productRequest);
		}

		this.toastrService.primary(
			this.getTranslation('INVENTORY_PAGE.INVENTORY_ITEM_SAVED'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
	}

	async onSaveProductVarinat(productVariantRequest: any) {
		await this.productVariantSettingsService.updateProductVariantSettings(
			productVariantRequest.productVariantSettings
		);

		await this.productVariantPriceService.updateProductVariantPrice(
			productVariantRequest.productVariantPrice
		);

		await this.productVariantService.updateProductVariant(
			productVariantRequest.productVariant
		);

		const oldVariant = this.product.variants.find(
			(v) => v.id === productVariantRequest.productVariant.id
		);

		const newProductVariant = await this.productVariantService.getProductVariant(
			oldVariant.id
		);

		this.product.variants[
			this.product.variants.indexOf(oldVariant)
		] = newProductVariant;

		this.closeDialog('PRODUCT_VARIANT_EDIT');

		this.toastrService.primary(
			this.getTranslation('INVENTORY_PAGE.PRODUCT_VARIANT_SAVED'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
	}

	async onEditProductVariant(productVariantId: string) {
		this.editProductVariant = this.product.variants.find((variant) => {
			return variant.id === productVariantId;
		});
		this.edit = 'product-variant';
	}

	closeDialog(hideForm: string) {
		switch (hideForm) {
			case 'PRODUCT_EDIT':
				this.dialogRef.close(this.product);
				break;
			case 'PRODUCT_VARIANT_EDIT':
				this.edit = 'product';
				break;
		}
	}
}

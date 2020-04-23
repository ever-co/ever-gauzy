import { Component, OnInit } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef } from '@nebular/theme';
import {
	Product,
	ProductVariant,
	BillingInvoicingPolicyEnum
} from '@gauzy/models';
import { FormGroup } from '@angular/forms';
import { ProductService } from '../../@core/services/product.service';
import { ProductVariantService } from '../../@core/services/product-variant.service';

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
		public dialogRef: NbDialogRef<ProductMutationComponent>,
		private productService: ProductService,
		private productVariantService: ProductVariantService
	) {
		super(translationService);
	}

	async onSaveProduct(productRequest: Product) {
		let product: Product;

		if (!productRequest.id) {
			this.product = await this.productService.create(productRequest);
			this.product.variants = await this.productVariantService.createProductVariants(
				this.product
			);
		} else {
			product = await this.productService.update(productRequest);
		}

		// this.closeDialog(product);
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

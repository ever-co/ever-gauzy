import { Component } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef } from '@nebular/theme';
import { Product } from '@gauzy/models';
import { FormGroup } from '@angular/forms';
import { ProductService } from '../../@core/services/product.service';

@Component({
	selector: 'ngx-product-mutation',
	templateUrl: './product-mutation.component.html',
	styleUrls: ['./product-mutation.component.scss']
})
export class ProductMutationComponent extends TranslationBaseComponent {
	form: FormGroup;
	productItem: Product;

	edit = 'product-variant';

	constructor(
		readonly translationService: TranslateService,
		public dialogRef: NbDialogRef<ProductMutationComponent>,
		private productService: ProductService
	) {
		super(translationService);
	}

	async onSaveProduct(productRequest: Product) {
		let product: Product;

		if (!productRequest.id) {
			product = await this.productService.create(productRequest);
		} else {
			product = await this.productService.update(productRequest);
		}

		this.closeDialog(product);
	}

	async closeDialog(product?: Product) {
		this.dialogRef.close(product);
	}
}

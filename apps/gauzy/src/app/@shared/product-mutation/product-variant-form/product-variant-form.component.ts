import { Component, Output, EventEmitter } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { ProductVariant } from '@gauzy/models';

@Component({
	selector: 'ngx-product-variant-form',
	templateUrl: './product-variant-form.component.html',
	styleUrls: ['./product-variant-form.component.scss']
})
export class ProductVariantFormComponent extends TranslationBaseComponent {
	@Output() save = new EventEmitter<ProductVariant>();
	@Output() cancel = new EventEmitter<void>();

	constructor(translationService: TranslateService) {
		super(translationService);
	}

	onCancel() {
		this.cancel.emit();
	}

	onSaveRequest() {}
}

import { Component, OnInit } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef } from '@nebular/theme';
import { Product } from '@gauzy/models';
import { FormGroup } from '@angular/forms';

@Component({
	selector: 'ngx-product-mutation',
	templateUrl: './product-mutation.component.html',
	styleUrls: ['./product-mutation.component.scss']
})
export class ProductMutationComponent extends TranslationBaseComponent
	implements OnInit {
	form: FormGroup;
	productItem: Product;

	constructor(
		readonly translationService: TranslateService,
		public dialogRef: NbDialogRef<ProductMutationComponent>
	) {
		super(translationService);
	}

	ngOnInit() {}

	closeDialog() {}

	onSaveRequest() {}
}

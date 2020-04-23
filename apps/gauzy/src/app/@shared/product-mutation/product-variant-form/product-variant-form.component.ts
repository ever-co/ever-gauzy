import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { ProductVariant } from '@gauzy/models';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

@Component({
	selector: 'ngx-product-variant-form',
	templateUrl: './product-variant-form.component.html',
	styleUrls: ['./product-variant-form.component.scss']
})
export class ProductVariantFormComponent extends TranslationBaseComponent
	implements OnInit {
	@Output() save = new EventEmitter<ProductVariant>();
	@Output() cancel = new EventEmitter<void>();

	form: FormGroup;
	productVariant: ProductVariant;

	constructor(translationService: TranslateService, private fb: FormBuilder) {
		super(translationService);
	}
	ngOnInit(): void {
		this._initializeForm();
	}

	private _initializeForm() {
		this.form = this.fb.group({
			internationalReference: ['', Validators.required],
			invoicingPolicy: ['', Validators.required],
			quantity: ['', Validators.required],
			taxes: ['', Validators.required],
			retailPrice: [true],
			retailPriceCurrency: ['', Validators.required],
			unitCost: ['', Validators.required],
			unitCostCurrency: ['', Validators.required],
			enabled: ['', Validators.required],
			isSubscription: [false, Validators.required],
			isPurchaseAutomatically: [false, Validators.required],
			canBeSold: [true, Validators.required],
			canBePurchased: [true, Validators.required],
			canBeCharged: [false, Validators.required],
			canBeRented: [false, Validators.required],
			trackInventory: [false, Validators.required],
			isEquipment: [false, Validators.required],
			notes: ['', Validators.required]
		});
	}

	onCancel() {
		this.cancel.emit();
	}

	onSaveRequest() {}
}

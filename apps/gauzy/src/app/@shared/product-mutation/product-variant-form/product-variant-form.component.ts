import { Component, Output, EventEmitter, OnInit, Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import {
	ProductVariant,
	CurrenciesEnum,
	BillingInvoicingPolicyEnum
} from '@gauzy/models';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

@Component({
	selector: 'ngx-product-variant-form',
	templateUrl: './product-variant-form.component.html',
	styleUrls: ['./product-variant-form.component.scss']
})
export class ProductVariantFormComponent extends TranslationBaseComponent
	implements OnInit {
	@Output() save = new EventEmitter<ProductVariant>();
	@Output() cancel = new EventEmitter<string>();

	currencies = Object.values(CurrenciesEnum);
	billingInvoicingPolicies = Object.values(BillingInvoicingPolicyEnum);

	form: FormGroup;
	@Input() productVariant: ProductVariant;

	constructor(translationService: TranslateService, private fb: FormBuilder) {
		super(translationService);
	}
	ngOnInit(): void {
		this._initializeForm();
	}

	private _initializeForm() {
		this.form = this.fb.group({
			internationalReference: [
				this.productVariant.internalReference || '',
				Validators.required
			],
			invoicingPolicy: [
				this.productVariant.billingInvoicingPolicy || '',
				Validators.required
			],
			quantity: [this.productVariant.quantity || 0, Validators.required],
			taxes: [this.productVariant.taxes || 0, Validators.required],
			retailPrice: [
				this.productVariant.price.retailPrice || 0,
				Validators.required
			],
			retailPriceCurrency: [
				this.productVariant.price.retailPriceCurrency ||
					CurrenciesEnum.USD,
				Validators.required
			],
			unitCost: [
				this.productVariant.price.unitCost || 0,
				Validators.required
			],
			unitCostCurrency: [
				this.productVariant.price.unitCostCurrency ||
					CurrenciesEnum.USD,
				Validators.required
			],
			enabled: [this.productVariant.enabled || true, Validators.required],
			isSubscription: [
				this.productVariant.settings.isSubscription || false
			],
			isPurchaseAutomatically: [
				this.productVariant.settings.isPurchaseAutomatically || false
			],
			canBeSold: [this.productVariant.settings.canBeSold || true],
			canBePurchased: [
				this.productVariant.settings.canBePurchased || true
			],
			canBeCharged: [this.productVariant.settings.canBeCharged || true],
			canBeRented: [this.productVariant.settings.canBeRented || false],
			trackInventory: [
				this.productVariant.settings.trackInventory || false
			],
			isEquipment: [this.productVariant.settings.isEquipment || false],
			notes: [this.productVariant.notes || '']
		});
	}

	onCancel() {
		this.cancel.emit('PRODUCT_VARIANT_EDIT');
	}

	onSaveRequest() {}
}

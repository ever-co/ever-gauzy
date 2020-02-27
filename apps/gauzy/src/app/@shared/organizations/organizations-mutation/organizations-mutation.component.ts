import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import {
	CurrenciesEnum,
	DefaultValueDateTypeEnum,
	BonusTypeEnum,
	DEFAULT_PROFIT_BASED_BONUS
} from '@gauzy/models';

@Component({
	selector: 'ngx-organizations-mutation',
	templateUrl: './organizations-mutation.component.html',
	styleUrls: [
		'./organizations-mutation.component.scss',
		'../../../@shared/user/edit-profile-form/edit-profile-form.component.scss'
	]
})
export class OrganizationsMutationComponent implements OnInit {
	form: FormGroup;
	hoverState: boolean;
	currencies: string[] = Object.values(CurrenciesEnum);
	defaultValueDateTypes: string[] = Object.values(DefaultValueDateTypeEnum);
	defaultBonusTypes: string[] = Object.values(BonusTypeEnum);
	constructor(
		private fb: FormBuilder,
		protected dialogRef: NbDialogRef<OrganizationsMutationComponent>,
		private toastrService: NbToastrService
	) {}

	async ngOnInit() {
		this._initializedForm();
	}

	addOrganization() {
		this.dialogRef.close(this.form.value);
	}

	handleImageUploadError(error) {
		this.toastrService.danger(error, 'Error');
	}

	loadDefaultBonusPercentage(bonusType: BonusTypeEnum) {
		const bonusPercentageControl = this.form.get('bonusPercentage');

		switch (bonusType) {
			case BonusTypeEnum.PROFIT_BASED_BONUS:
				bonusPercentageControl.setValue(75);
				bonusPercentageControl.enable();
				break;
			case BonusTypeEnum.REVENUE_BASED_BONUS:
				bonusPercentageControl.setValue(10);
				bonusPercentageControl.enable();
				break;
			default:
				bonusPercentageControl.setValue(null);
				bonusPercentageControl.disable();
				break;
		}
	}

	private _initializedForm() {
		this.form = this.fb.group({
			currency: ['', Validators.required],
			name: ['', Validators.required],
			imageUrl: [
				'https://dummyimage.com/330x300/8b72ff/ffffff.jpg&text',
				Validators.required
			], // TODO: fix that when the internet is here!
			defaultValueDateType: ['', Validators.required],
			bonusType: [BonusTypeEnum.PROFIT_BASED_BONUS],
			bonusPercentage: [
				DEFAULT_PROFIT_BASED_BONUS,
				[Validators.min(0), Validators.max(100)]
			]
		});
	}
}

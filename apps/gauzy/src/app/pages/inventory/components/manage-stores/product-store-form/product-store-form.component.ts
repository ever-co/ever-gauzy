import { UntilDestroy } from '@ngneat/until-destroy';
import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import {
	ITag,
} from '@gauzy/contracts';
import { NbStepperComponent } from '@nebular/theme';


@UntilDestroy()
@Component({
	selector: 'ga-product-store-form',
	templateUrl: './product-store-form.component.html',
	styleUrls: ['./product-store-form.component.scss']
})
export class ProductStoreFormComponent
	extends TranslationBaseComponent
	implements OnInit {
	tags: ITag[] = [];

	// @ViewChild('stepper') stepper: NbStepperComponent;


	constructor(
		readonly translateService: TranslateService,

	) {
		super(translateService);
	}

	ngOnInit(): void {

	}

	cancel() {

	}

	onSaveRequest() {

	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}


}

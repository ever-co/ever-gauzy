import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';

@Component({
	selector: 'ngx-feature',
	templateUrl: './feature.component.html',
	styleUrls: ['./feature.component.scss']
})
export class FeatureComponent
	extends TranslationBaseComponent
	implements OnInit {
	constructor(readonly translate: TranslateService) {
		super(translate);
	}

	ngOnInit(): void {}
}

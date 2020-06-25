import { Component } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-manage-candidate-interviews',
	templateUrl: './manage-candidate-interviews.component.html',
	styleUrls: ['./manage-candidate-interviews.component.scss']
})
export class ManageCandidateInterviewsComponent extends TranslationBaseComponent {
	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}
}

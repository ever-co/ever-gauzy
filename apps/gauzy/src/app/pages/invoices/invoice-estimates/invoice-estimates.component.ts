import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { OnInit, Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-estimates',
	templateUrl: './invoice-estimates.component.html',
	styleUrls: ['./invoice-estimates.component.scss'],
})
export class EstimatesComponent extends TranslationBaseComponent
	implements OnInit {
	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {}
}

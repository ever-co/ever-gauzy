import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { OnInit, Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'ga-estimates',
    templateUrl: './invoice-estimates.component.html',
    standalone: false
})
export class EstimatesComponent extends TranslationBaseComponent implements OnInit {
	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {}
}

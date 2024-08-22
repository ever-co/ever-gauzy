import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@Component({
	selector: 'ngx-share',
	template: `
		<ngx-public-layout>
			<router-outlet></router-outlet>
		</ngx-public-layout>
	`
})
export class ShareComponent extends TranslationBaseComponent {
	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}
}

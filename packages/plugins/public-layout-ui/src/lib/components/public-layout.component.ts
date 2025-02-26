import { Component } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@Component({
    selector: 'gz-public-layout',
    template: `
		<ngx-public-layout>
			<router-outlet></router-outlet>
		</ngx-public-layout>
	`,
    standalone: false
})
export class PublicLayoutComponent extends TranslationBaseComponent {
	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}
}

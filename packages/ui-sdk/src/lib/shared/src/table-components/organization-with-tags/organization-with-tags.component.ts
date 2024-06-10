import { Component } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { PictureNameTagsComponent } from '../picture-name-tags/picture-name-tags.component';

@Component({
	selector: 'gauzy-organization-with-tags',
	templateUrl: './organization-with-tags.component.html',
	styleUrls: ['./organization-with-tags.component.scss']
})
export class OrganizationWithTagsComponent extends PictureNameTagsComponent {
	constructor(
		protected readonly themeService: NbThemeService,
		protected readonly translateService: TranslateService
	) {
		super(themeService, translateService);
	}
}

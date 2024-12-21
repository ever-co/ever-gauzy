import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NbThemeService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { PictureNameTagsComponent } from '../picture-name-tags/picture-name-tags.component';

@Component({
    selector: 'ga-contact-link-with-tags',
    templateUrl: './contact-with-tags.component.html',
    styleUrls: ['./contact-with-tags.component.scss'],
    standalone: false
})
export class ContactWithTagsComponent extends PictureNameTagsComponent {
	constructor(
		private readonly _router: Router,
		readonly themeService: NbThemeService,
		readonly translateService: TranslateService
	) {
		super(themeService, translateService);
	}

	navigateToContact() {
		if (!this.rowData) {
			return;
		}
		this._router.navigate([`/pages/contacts/view/${this.rowData.id}`]);
	}
}

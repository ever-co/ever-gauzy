import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { NbThemeService } from '@nebular/theme';
import { PictureNameTagsComponent } from '../picture-name-tags/picture-name-tags.component';

@Component({
	selector: 'ga-contact-link-with-tags',
	templateUrl: './contact-with-tags.component.html',
	styleUrls: ['./contact-with-tags.component.scss']
})
export class ContactWithTagsComponent extends PictureNameTagsComponent {
	constructor(
		private readonly _router: Router,
		readonly themeService: NbThemeService
	) {
		super(themeService);
	}

	navigateToContact() {
		if (!this.rowData) {
			return;
		}
		this._router.navigate([`/pages/contacts/view/${this.rowData.id}`]);
	}
}

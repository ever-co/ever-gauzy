import { Component } from '@angular/core';
import { NbThemeService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { PictureNameTagsComponent } from '../picture-name-tags/picture-name-tags.component';

@Component({
    selector: 'gauzy-organization-with-tags',
    templateUrl: './organization-with-tags.component.html',
    styleUrls: ['./organization-with-tags.component.scss'],
    standalone: false
})
export class OrganizationWithTagsComponent extends PictureNameTagsComponent {
	/** Set when the row's logo URL is present but fails to load. */
	logoFailed = false;

	/**
	 * The row's logo.
	 *
	 * `imageUrl` is the column; `image.fullUrl` is the uploaded asset the Main tab
	 * writes to. The card header and the Main tab both resolve the asset first and
	 * fall back to the column, and this cell now agrees with them — reading only
	 * `imageUrl` left every organization whose logo came from an upload showing no
	 * logo in the list.
	 */
	get logoUrl(): string {
		return this.rowData?.image?.fullUrl || this.rowData?.imageUrl;
	}

	constructor(
		protected readonly themeService: NbThemeService,
		protected readonly translateService: TranslateService
	) {
		super(themeService, translateService);
	}
}

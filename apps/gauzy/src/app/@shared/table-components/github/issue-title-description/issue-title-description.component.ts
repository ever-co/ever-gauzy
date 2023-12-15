import { Component, Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ViewCell } from 'ng2-smart-table';
import { TranslationBaseComponent } from './../../../../@shared/language-base';

@Component({
	selector: 'issue-title-description',
	templateUrl: './issue-title-description.component.html',
	styleUrls: ['./issue-title-description.component.scss']
})
export class GithubIssueTitleDescriptionComponent extends TranslationBaseComponent implements ViewCell {

	@Input() rowData: any;
	@Input() value: string | number;

	constructor(
		public readonly translateService: TranslateService
	) {
		super(translateService);
	}

	/**
	 *
	 * @returns
	 */
	public openIssue() {
		if (!this.rowData) {
			return;
		}
		if (this.rowData?.html_url) {
			window.open(this.rowData.html_url, '_blank');
		}
	}
}

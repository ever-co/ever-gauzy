import { Component, Input } from '@angular/core';
import { JobPostStatusEnum } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';

@Component({
    selector: 'job-status',
    templateUrl: './job-status.component.html',
    styleUrls: ['./job-status.component.scss'],
    providers: [],
    standalone: false
})
export class JobStatusComponent extends TranslationBaseComponent {
	constructor(translateService: TranslateService) {
		super(translateService);
	}

	@Input() rowData: any;
	@Input() value: string;

	/**
	 * Get job status text and class
	 *
	 * @param status
	 */
	getJobStatus(status: JobPostStatusEnum) {
		let badgeClass: string, badgeText: string;

		switch (status.toLowerCase()) {
			case JobPostStatusEnum.CLOSED.toLowerCase():
				badgeClass = 'danger';
				badgeText = this.getTranslation('JOBS.CLOSED');
				break;
			case JobPostStatusEnum.OPEN.toLowerCase():
				badgeClass = 'success';
				badgeText = this.getTranslation('JOBS.OPEN');
				break;
			case JobPostStatusEnum.APPLIED.toLowerCase():
				badgeClass = 'primary';
				badgeText = this.getTranslation('JOBS.APPLIED');
				break;
			default:
				badgeClass = 'default';
				badgeText = status;
				break;
		}
		return {
			text: badgeText,
			class: badgeClass
		};
	}
}

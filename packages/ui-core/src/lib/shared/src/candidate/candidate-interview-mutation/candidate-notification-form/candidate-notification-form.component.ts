import { Component, OnDestroy, Input, ViewChild } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
import { ICandidateInterview, ICandidate } from '@gauzy/contracts';
import { CandidateEmailComponent } from './candidate-email/candidate-email.component';
@Component({
	selector: 'ga-candidate-notification-form',
	templateUrl: './candidate-notification-form.component.html',
	styleUrls: ['./candidate-notification-form.component.scss']
})
export class CandidateNotificationFormComponent implements OnDestroy {
	@Input() interview: ICandidateInterview;
	@Input() selectedCandidate: ICandidate;
	@Input() employees: any[];
	candidateForm: UntypedFormGroup;
	interviewerForm: UntypedFormGroup;
	isCandidateNotification = false;
	isInterviewerNotification = false;

	@ViewChild('emailCandidateForm')
	emailCandidateForm: CandidateEmailComponent;

	@ViewChild('emailInterviewerForm')
	emailInterviewerForm: CandidateEmailComponent;

	constructor() {}

	notification() {
		if (this.emailCandidateForm) {
			this.emailCandidateForm.loadFormData();
		}
		if (this.emailInterviewerForm) {
			this.emailInterviewerForm.loadFormData();
		}
	}

	checkedCandidate(checked: boolean) {
		this.isCandidateNotification = checked;
	}

	checkedInterviewer(checked: boolean) {
		this.isInterviewerNotification = checked;
	}

	ngOnDestroy() {}
}

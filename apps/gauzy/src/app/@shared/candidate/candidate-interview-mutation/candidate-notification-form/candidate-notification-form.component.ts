import { Component, OnDestroy, Input, ViewChild } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';

import { ICandidateInterview, Candidate } from '@gauzy/models';
import { CandidateEmailComponent } from './candidate-email/candidate-email.component';
@Component({
	selector: 'ga-candidate-notification-form',
	templateUrl: 'candidate-notification-form.component.html',
	styleUrls: ['candidate-notification-form.component.scss']
})
export class CandidateNotificationFormComponent implements OnDestroy {
	@Input() interview: ICandidateInterview;
	@Input() selectedCandidate: Candidate;
	@Input() employees: any[];
	candidateForm: FormGroup;
	interviewerForm: FormGroup;
	isCandidateNotification = false;
	isInterviewerNotification = false;

	@ViewChild('emailCandidateForm')
	emailCandidateForm: CandidateEmailComponent;

	@ViewChild('emailInterviewerForm')
	emailInterviewerForm: CandidateEmailComponent;

	private _ngDestroy$ = new Subject<void>();
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
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

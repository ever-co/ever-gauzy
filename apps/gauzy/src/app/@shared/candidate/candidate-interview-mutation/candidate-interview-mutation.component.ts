import { CandidateInterviewFormComponent } from './../candidate-interview-form/candidate-interview-form.component';
import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import {
	NbDialogRef,
	NbToastrService,
	NbStepperComponent
} from '@nebular/theme';
import { Candidate, ICandidateInterviewCreateInput } from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';
import { FormGroup } from '@angular/forms';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { CandidatesService } from '../../../@core/services/candidates.service';

@Component({
	selector: 'ga-candidate-interview-mutation',
	templateUrl: 'candidate-interview-mutation.component.html',
	styleUrls: ['candidate-interview-mutation.component.scss']
})
export class CandidateInterviewMutationComponent
	implements OnInit, AfterViewInit {
	@ViewChild('stepper', { static: false })
	stepper: NbStepperComponent;

	@ViewChild('candidateInterviewForm', { static: false })
	candidateInterviewForm: CandidateInterviewFormComponent;

	form: FormGroup;
	interviews: ICandidateInterviewCreateInput[] = [];
	constructor(
		protected dialogRef: NbDialogRef<CandidateInterviewMutationComponent>,
		protected organizationsService: OrganizationsService,
		protected toastrService: NbToastrService,
		protected store: Store,
		protected candidatesService: CandidatesService,
		private errorHandler: ErrorHandlingService
	) {}

	ngOnInit(): void {}

	async ngAfterViewInit() {
		this.form = this.candidateInterviewForm.form;
	}
	closeDialog(candidate: Candidate[] = null) {
		this.dialogRef.close(candidate);
	}
	addInterview() {
		console.log('111');
		const interviewers = this.form.get('interviewers').value || null;
		const location = this.form.get('location').value || null;
		const note = this.form.get('note').value || null;

		const newInterview: ICandidateInterviewCreateInput = {
			title: this.form.get('title').value,
			date: this.form.get('date').value,
			interviewers,
			location,
			duration: this.form.get('duration').value,
			timeZone: this.form.get('timeZone').value,
			note
			// interviewersNotification: this.form.get('interviewersNotification')
			// 	.value,
			// candidateNotification: this.form.get('candidateNotification').value
		};

		this.interviews.push(newInterview);
		this.candidateInterviewForm.loadFormData();
		this.form = this.candidateInterviewForm.form;

		this.stepper.reset();
	}
	async add() {
		this.addInterview();
		try {
			// const candidate = await this.candidatesService
			// 	.createBulk(this.candidates)
			// 	.pipe(first())
			// 	.toPromise();
			// this.closeDialog(candidate);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}
}

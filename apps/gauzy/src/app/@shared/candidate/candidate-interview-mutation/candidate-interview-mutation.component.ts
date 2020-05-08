import { CandidateInterviewFormComponent } from './../candidate-interview-form/candidate-interview-form.component';
import {
	Component,
	OnInit,
	ViewChild,
	AfterViewInit,
	OnDestroy
} from '@angular/core';
import {
	NbDialogRef,
	NbToastrService,
	NbStepperComponent
} from '@nebular/theme';
import {
	Candidate,
	ICandidateInterviewCreateInput,
	ICandidateInterview,
	Employee
} from '@gauzy/models';
import { Store } from '../../../@core/services/store.service';
import { FormGroup } from '@angular/forms';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { CandidatesService } from '../../../@core/services/candidates.service';
import { ActivatedRoute } from '@angular/router';
import { takeUntil, first } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CandidateInterviewService } from '../../../@core/services/candidate-interview.service';
import { EmployeesService } from '../../../@core/services';

@Component({
	selector: 'ga-candidate-interview-mutation',
	templateUrl: 'candidate-interview-mutation.component.html',
	styleUrls: ['candidate-interview-mutation.component.scss']
})
export class CandidateInterviewMutationComponent
	implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild('stepper', { static: false })
	stepper: NbStepperComponent;

	@ViewChild('candidateInterviewForm', { static: false })
	candidateInterviewForm: CandidateInterviewFormComponent;

	form: FormGroup;
	interview: ICandidateInterviewCreateInput;
	private _ngDestroy$ = new Subject<void>();
	selectedCandidate: Candidate;
	employees: Employee[] = [];
	constructor(
		protected dialogRef: NbDialogRef<CandidateInterviewMutationComponent>,
		protected employeesService: EmployeesService,
		protected toastrService: NbToastrService,
		protected store: Store,
		private candidateInterviewService: CandidateInterviewService,
		protected candidatesService: CandidatesService,
		private errorHandler: ErrorHandlingService,
		private route: ActivatedRoute
	) {}

	ngOnInit() {
		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				const id = params.id;

				const { items } = await this.candidatesService
					.getAll(['user', 'organizationPosition', 'tags'], { id })
					.pipe(first())
					.toPromise();

				this.selectedCandidate = items[0];
			});
	}

	async ngAfterViewInit() {
		this.form = this.candidateInterviewForm.form;
	}
	closeDialog(interview: ICandidateInterview = null) {
		this.dialogRef.close(interview);
	}
	async addInterview() {
		this.candidateInterviewForm.loadFormData();
		const formInterview = this.candidateInterviewForm.form.value;
		this.interview = {
			title: this.form.get('title').value,
			interviewers: formInterview.interviewers,
			location: this.form.get('location').value,
			startTime: formInterview.startTime,
			endTime: formInterview.endTime,
			note: this.form.get('note').value
		};
		for (let i = 0; i < formInterview.interviewers.length; i++) {
			try {
				const res = await this.employeesService
					.getAll(['user'], { id: formInterview.interviewers[i] })
					.pipe(first())
					.toPromise();
				this.employees.push(res.items[0]);
			} catch (error) {
				this.errorHandler.handleError(error);
			}
		}
	}
	async add() {
		this.addInterview();
		try {
			const interview = await this.candidateInterviewService.create({
				...this.interview,
				candidateId: this.selectedCandidate.id
			});
			this.closeDialog(interview);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}
	previous() {
		this.candidateInterviewForm.form.patchValue(this.interview);
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

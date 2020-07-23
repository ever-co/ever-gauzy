import {
	UserFindInput,
	Candidate,
	CandidateUpdateInput,
	ICandidateInterview
} from '@gauzy/models';
import { BehaviorSubject, Observable } from 'rxjs';
import { Injectable } from '@angular/core';
import { CandidateInterviewService } from './candidate-interview.service';

/**
 * Service used to update candidate
 */
@Injectable()
export class CandidateStore {
	private _selectedCandidate: Candidate;
	private _userForm: UserFindInput;
	private _candidateForm: CandidateUpdateInput;
	selectedCandidate$: BehaviorSubject<Candidate> = new BehaviorSubject(
		this.selectedCandidate
	);
	userForm$: BehaviorSubject<UserFindInput> = new BehaviorSubject(
		this.userForm
	);
	candidateForm$: BehaviorSubject<CandidateUpdateInput> = new BehaviorSubject(
		this.candidateForm
	);
	private _interviewList$: BehaviorSubject<
		ICandidateInterview[]
	> = new BehaviorSubject([]);
	public interviewList$: Observable<
		ICandidateInterview[]
	> = this._interviewList$.asObservable();

	constructor(
		private _candidateInterviewService: CandidateInterviewService
	) {}

	//TO DO

	// getInterviewList() {
	// 	this._candidateInterviewService
	// 		.getAllInterviews([
	// 			'feedbacks',
	// 			'interviewers',
	// 			'technologies',
	// 			'personalQualities',
	// 			'candidate'
	// 		])
	// 		.pipe(tap(({ items }) => this.loadAllInterviews(items)))
	// 		.subscribe();
	// }

	// loadAllInterviews(interviewList: ICandidateInterview[]): void {
	// 	this._interviewList$.next(interviewList);
	// }

	set selectedCandidate(candidate: Candidate) {
		this._selectedCandidate = candidate;
		this.selectedCandidate$.next(candidate);
	}

	get selectedCandidate(): Candidate {
		return this._selectedCandidate;
	}

	set userForm(user: UserFindInput) {
		this._userForm = user;
		this.userForm$.next(user);
	}

	get userForm(): UserFindInput {
		return this._userForm;
	}

	set candidateForm(candidate: CandidateUpdateInput) {
		this._candidateForm = candidate;
		this.candidateForm$.next(candidate);
	}

	get candidateForm(): CandidateUpdateInput {
		return this._candidateForm;
	}

	clear() {
		localStorage.clear();
	}
}

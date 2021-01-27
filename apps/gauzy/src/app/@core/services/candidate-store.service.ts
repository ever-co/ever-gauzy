import {
	IUserFindInput,
	ICandidate,
	ICandidateUpdateInput,
	ICandidateInterview
} from '@gauzy/contracts';
import { BehaviorSubject, Observable } from 'rxjs';
import { Injectable } from '@angular/core';

/**
 * Service used to update candidate
 */
@Injectable()
export class CandidateStore {
	private _selectedCandidate: ICandidate;
	private _userForm: IUserFindInput;
	private _candidateForm: ICandidateUpdateInput;
	selectedCandidate$: BehaviorSubject<ICandidate> = new BehaviorSubject(
		this.selectedCandidate
	);
	userForm$: BehaviorSubject<IUserFindInput> = new BehaviorSubject(
		this.userForm
	);
	candidateForm$: BehaviorSubject<ICandidateUpdateInput> = new BehaviorSubject(
		this.candidateForm
	);
	private _interviewList$: BehaviorSubject<
		ICandidateInterview[]
	> = new BehaviorSubject([]);
	public interviewList$: Observable<
		ICandidateInterview[]
	> = this._interviewList$.asObservable();

	get interviewList(): Observable<ICandidateInterview[]> {
		return this._interviewList$.asObservable();
	}

	loadInterviews(interviewList: ICandidateInterview[]): void {
		this._interviewList$.next(interviewList);
	}

	set selectedCandidate(candidate: ICandidate) {
		this._selectedCandidate = candidate;
		this.selectedCandidate$.next(candidate);
	}

	get selectedCandidate(): ICandidate {
		return this._selectedCandidate;
	}

	set userForm(user: IUserFindInput) {
		this._userForm = user;
		this.userForm$.next(user);
	}

	get userForm(): IUserFindInput {
		return this._userForm;
	}

	set candidateForm(candidate: ICandidateUpdateInput) {
		this._candidateForm = candidate;
		this.candidateForm$.next(candidate);
	}

	get candidateForm(): ICandidateUpdateInput {
		return this._candidateForm;
	}

	clear() {
		localStorage.clear();
	}
}

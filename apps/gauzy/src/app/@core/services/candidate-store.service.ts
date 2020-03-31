import { UserFindInput, Candidate, CandidateUpdateInput } from '@gauzy/models';
import { BehaviorSubject } from 'rxjs';

/**
 * Service used to update candidate
 */
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

import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Params } from '@angular/router';
import { Organization, Candidate } from '@gauzy/models';
import { NbToastrService } from '@nebular/theme';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';

/**
 * This component contains the properties stored within the User Entity of an candidate.
 * Any property which is either stored directly in the candidate entity or as a relation of the candidate entity should NOT be put in this Component
 */
@Component({
	selector: 'ga-edit-candidate-main',
	templateUrl: './edit-candidate-main.component.html',
	styleUrls: [
		'../../../../organizations/edit-organization/edit-organization-settings/edit-organization-main/edit-organization-main.component.scss'
	]
})
export class EditCandidateMainComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	form: FormGroup;
	paramSubscription: Subscription;
	hoverState: boolean;
	routeParams: Params;
	selectedCandidate: Candidate;
	selectedOrganization: Organization;

	constructor(
		private readonly fb: FormBuilder,
		private readonly store: Store,
		private readonly toastrService: NbToastrService,
		private readonly candidateStore: CandidateStore
	) {}

	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (candidate) => {
				this.selectedCandidate = candidate;

				if (this.selectedCandidate) {
					this._initializeForm(this.selectedCandidate);
				}

				this.store.selectedOrganization$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((organization) => {
						this.selectedOrganization = organization;
					});
			});
	}

	handleImageUploadError(error: any) {
		this.toastrService.danger(error);
	}

	async submitForm() {
		if (this.form.valid) {
			this.candidateStore.userForm = {
				...this.form.value
			};
		}
	}

	private _initializeForm(candidate: Candidate) {
		this.form = this.fb.group({
			username: [candidate.user.username],
			email: [candidate.user.email, Validators.required],
			firstName: [candidate.user.firstName],
			lastName: [candidate.user.lastName],
			imageUrl: [candidate.user.imageUrl, Validators.required]
		});
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

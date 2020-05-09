import { Component, OnInit, Input } from '@angular/core';
import { Candidate } from '@gauzy/models';
import { FormGroup, FormBuilder } from '@angular/forms';
import { CandidatesService } from '../../../@core/services/candidates.service';
import { Subject } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { takeUntil, first } from 'rxjs/operators';

@Component({
	selector: 'ga-candidate-email',
	templateUrl: 'candidate-email.component.html',
	styleUrls: ['candidate-email.component.scss']
})
export class CandidateEmailComponent implements OnInit {
	@Input() isInterviewer: boolean;
	@Input() isCandidate: boolean;
	form: FormGroup;
	formCV: FormGroup;
	public value = `
	<p>
		You invited to 
		<strong> </strong>
	</p>
	<p>When <strong> </strong></p>
	
	<p>Interviewer(s) <strong> </strong></p>

	
`;
	private _ngDestroy$ = new Subject<void>();
	selectedCandidate: Candidate;

	constructor(
		protected candidatesService: CandidatesService,
		private route: ActivatedRoute,
		private readonly fb: FormBuilder
	) {}

	ngOnInit() {
		this.loadFormData();
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

	public valueChange(value: any): void {}
	loadFormData() {
		this.form = this.fb.group({
			text: ['']
		});
	}
}

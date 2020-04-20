import { OnInit, OnDestroy, Component } from '@angular/core';
import { Subject } from 'rxjs';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { takeUntil, first } from 'rxjs/operators';
import { Candidate } from '@gauzy/models';
import { FormGroup, FormBuilder } from '@angular/forms';
import { CandidatesService } from 'apps/gauzy/src/app/@core/services/candidates.service';
import { ActivatedRoute } from '@angular/router';

@Component({
	selector: 'ga-edit-candidate-skills',
	templateUrl: './edit-candidate-skills.component.html'
})
export class EditCandidateSkillsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	skills: string[] = [];
	showAddCard: boolean;
	showEditDiv = [];

	selectedCandidate: Candidate;
	form: FormGroup;
	constructor(
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private candidatesService: CandidatesService,
		private fb: FormBuilder,
		private route: ActivatedRoute
	) {
		super(translateService);
	}

	ngOnInit() {
		// this.candidateStore.selectedCandidate$
		// 	.pipe(takeUntil(this._ngDestroy$))
		// 	.subscribe((candidate) => {
		// 		this.selectedCandidate = candidate;
		// 		if (this.selectedCandidate) {
		// 			this._initializeForm(this.selectedCandidate);
		// 		}
		// 	});
		// this.route.params
		// 	.pipe(takeUntil(this._ngDestroy$))
		// 	.subscribe(async (params) => {
		// 		const id = params.id;
		// 		const { items } = await this.candidatesService
		// 			.getAll(['user', 'tags'], { id })
		// 			.pipe(first())
		// 			.toPromise();
		// 		this.selectedCandidate = items[0];
		// 		this.candidateStore.selectedCandidate = this.selectedCandidate;
		// 	});
	}
	private async _initializeForm(candidate: Candidate) {
		this.form = this.fb.group({
			skills: [candidate.skills]
		});
	}
	showEditCard(index: number) {
		this.showEditDiv[index] = true;
	}
	removeSkill(index: number) {
		this.skills.splice(index, 1);
		this.selectedCandidate.skills = this.skills;
	}
	editSkill(skill: string, index: number) {
		this.skills[index] = skill;
		this.selectedCandidate.skills = this.skills;
		this.showEditDiv[index] = !this.showEditDiv[index];
	}
	cancel(index: number) {
		this.showEditDiv[index] = !this.showEditDiv[index];
	}

	async addSkill(skill: string) {
		if (skill !== '') {
			this.showAddCard = !this.showAddCard;
			this.skills.push(skill);
			this.selectedCandidate.skills = this.skills;
			try {
				await this.candidatesService.update(
					this.selectedCandidate.id,
					this.selectedCandidate
				);
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
		} else {
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.CANDIDATE.EXPERIENCE.INVALID_CANDIDATE_NAME'
				),
				this.getTranslation('TOASTR.MESSAGE.CANDIDATE_SKILL_REQUIRED')
			);
		}
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
	}
}

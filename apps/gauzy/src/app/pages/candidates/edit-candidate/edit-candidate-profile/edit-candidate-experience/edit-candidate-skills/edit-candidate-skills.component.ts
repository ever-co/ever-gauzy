import { Skill } from './../../../../../../../../../../libs/models/src/lib/candidate-skill.model';
import { OnInit, OnDestroy, Component } from '@angular/core';
import { Subject } from 'rxjs';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { takeUntil } from 'rxjs/operators';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { CandidateSkillsService } from 'apps/gauzy/src/app/@core/services/candidate-skills.service';

@Component({
	selector: 'ga-edit-candidate-skills',
	templateUrl: './edit-candidate-skills.component.html'
})
export class EditCandidateSkillsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	showAddCard: boolean;
	showEditDiv = [];
	skillId = null;
	candidateId: string;
	skillList: Skill[] = [];
	form: FormGroup;
	constructor(
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private fb: FormBuilder,
		private candidateSkillsService: CandidateSkillsService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidate) => {
				if (candidate) {
					this.candidateId = candidate.id;
					this._initializeForm();
					this.loadSkills();
				}
			});
	}
	private async _initializeForm() {
		this.form = new FormGroup({
			skills: this.fb.array([])
		});
		const skillForm = this.form.controls.skills as FormArray;
		skillForm.push(
			this.fb.group({
				name: ['', Validators.required]
			})
		);
	}
	private async loadSkills() {
		const res = await this.candidateSkillsService.getAll({
			candidateId: this.candidateId
		});
		if (res) {
			this.skillList = res.items;
		}
	}
	showEditCard(index: number, id: string) {
		this.showEditDiv[index] = true;
		this.skillId = id;
	}
	async removeSkill(id: string) {
		try {
			await this.candidateSkillsService.delete(id);
			this.toastrSuccess('DELETED');
			this.loadSkills();
		} catch (error) {
			this.toastrError(error);
		}
	}
	async editSkill(skill: string, index: number) {
		if (skill !== '') {
			try {
				await this.candidateSkillsService.update(this.skillId, {
					name: skill
				});
				this.loadSkills();
				this.toastrSuccess('UPDATED');
				(this.form.controls.skills as FormArray).reset();
				this.showEditDiv[index] = !this.showEditDiv[index];
			} catch (error) {
				this.toastrError(error);
			}
			this.skillId = null;
		} else {
			this.toastrService.danger(
				this.getTranslation('NOTES.CANDIDATE.EXPERIENCE.INVALID_FIELD'),
				this.getTranslation('TOASTR.MESSAGE.CANDIDATE_SKILLS_REQUIRED')
			);
		}
	}
	cancel(index: number) {
		this.showEditDiv[index] = !this.showEditDiv[index];
	}
	showCard() {
		this.showAddCard = !this.showAddCard;
		this.form.controls.skills.reset();
	}
	async addSkill() {
		const skillForm = this.form.controls.skills as FormArray;
		if (skillForm.valid) {
			const formValue = { ...skillForm.value[0] };
			try {
				await this.candidateSkillsService.create({
					...formValue,
					candidateId: this.candidateId
				});
				this.toastrSuccess('CREATED');
				this.loadSkills();
			} catch (error) {
				this.toastrError(error);
			}
			this.showAddCard = !this.showAddCard;
			skillForm.reset();
		} else {
			this.toastrService.danger(
				this.getTranslation('NOTES.CANDIDATE.EXPERIENCE.INVALID_FIELD'),
				this.getTranslation('TOASTR.MESSAGE.CANDIDATE_SKILLS_REQUIRED')
			);
		}
	}
	private toastrError(error) {
		this.toastrService.danger(
			this.getTranslation('NOTES.CANDIDATE.EXPERIENCE.ERROR', {
				error: error.error ? error.error.message : error.message
			}),
			this.getTranslation('TOASTR.TITLE.ERROR')
		);
	}
	private toastrSuccess(text: string) {
		this.toastrService.success(
			this.getTranslation('TOASTR.TITLE.SUCCESS'),
			this.getTranslation(`TOASTR.MESSAGE.CANDIDATE_EXPERIENCE_${text}`)
		);
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

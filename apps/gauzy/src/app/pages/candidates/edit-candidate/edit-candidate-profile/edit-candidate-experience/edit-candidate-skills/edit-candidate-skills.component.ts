import { OnInit, OnDestroy, Component } from '@angular/core';
import { Subject } from 'rxjs';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';

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
	constructor(
		private readonly toastrService: NbToastrService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		// this.route.params
		// 	.pipe(takeUntil(this._ngDestroy$))
		// 	.subscribe((params) => {
		// 		this.routeParams = params;
		// 	});
	}
	showEditCard(index: number) {
		this.showEditDiv[index] = true;
	}
	removeSkill(index: number) {
		return this.skills.splice(index, 1);
	}
	editSkill(skill: string, index: number) {
		this.skills[index] = skill;
		this.showEditDiv[index] = !this.showEditDiv[index];
	}
	cancel(index: number) {
		this.showEditDiv[index] = !this.showEditDiv[index];
	}

	addSkill(skill: string) {
		this.showAddCard = !this.showAddCard;
		if (skill !== '') {
			this.skills.push(skill);
		} else {
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.CANDIDATE.EXPERIENCE.INVALID_CANDIDATE_NAME'
				),
				this.getTranslation('TOASTR.MESSAGE.CANDIDATE_SKILL_REQUIRED')
			);
		}
	}
	// private async loadSkills() {
	// 	const { id } = this.routeParams;
	// 	const { items } = await this.candidatesService
	// 		.getAll(['user'], { id })
	// 		.pipe(first())
	// 		.toPromise();

	// 	this.selectedCandidate = items[0];
	// }

	ngOnDestroy() {
		this._ngDestroy$.next();
	}
}

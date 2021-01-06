import { OnInit, OnDestroy, Component } from '@angular/core';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { CandidateStore } from 'apps/gauzy/src/app/@core/services/candidate-store.service';
import { takeUntil } from 'rxjs/operators';
import { FormGroup, FormBuilder, FormArray, Validators } from '@angular/forms';
import { CandidateSkillsService } from 'apps/gauzy/src/app/@core/services/candidate-skills.service';
import { ISkill, ComponentLayoutStyleEnum, IOrganization } from '@gauzy/models';
import { ComponentEnum } from 'apps/gauzy/src/app/@core/constants/layout.constants';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { LocalDataSource } from 'ng2-smart-table';
import { ToastrService } from 'apps/gauzy/src/app/@core/services/toastr.service';

@Component({
	selector: 'ga-edit-candidate-skills',
	templateUrl: './edit-candidate-skills.component.html'
})
export class EditCandidateSkillsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	selectedOrganization: IOrganization;
	showAddCard: boolean;
	showEditDiv = [];
	skillId = null;
	candidateId: string;
	skillList: ISkill[] = [];
	form: FormGroup;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	settingsSmartTable: object;
	sourceSmartTable = new LocalDataSource();
	constructor(
		private readonly toastrService: ToastrService,
		readonly translateService: TranslateService,
		private candidateStore: CandidateStore,
		private store: Store,
		private fb: FormBuilder,
		private candidateSkillsService: CandidateSkillsService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.candidateStore.selectedCandidate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((candidate) => {
				if (candidate) {
					this.selectedOrganization = this.store.selectedOrganization;
					this.candidateId = candidate.id;
					this._initializeForm();
					this.loadSkills();
					this.loadSmartTable();
					this._applyTranslationOnSmartTable();
				}
			});
	}
	private async _initializeForm() {
		this.form = new FormGroup({
			skills: this.fb.array([])
		});
		const skillForm = this.skills;
		skillForm.push(
			this.fb.group({
				name: ['', Validators.required]
			})
		);
	}
	add() {
		this.showAddCard = true;
		this.skillId = null;
		this.form.reset();
	}
	setView() {
		this.viewComponentName = ComponentEnum.SKILLS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}
	private async loadSkills() {
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const { items = [] } = await this.candidateSkillsService.getAll({
			candidateId: this.candidateId,
			organizationId,
			tenantId
		});
		this.skillList = items;
	}
	showEditCard(index: number, id: string) {
		this.showEditDiv[index] = true;
		this.skillId = id;
	}
	async removeSkill(skill: any) {
		try {
			await this.candidateSkillsService.delete(skill.id);
			this.toastrService.success(
				'TOASTR.MESSAGE.CANDIDATE_SKILL_DELETED',
				{
					name: skill.name
				}
			);
			this.loadSkills();
		} catch (error) {
			this.toastrError(error);
		}
	}
	submitForm() {
		if (this.skillId) {
			const skillForm = this.skills;
			if (skillForm.valid) {
				const formValue = { ...skillForm.value[0] };
				this.editSkill(formValue.name);
			}
		} else {
			this.addSkill();
		}
	}
	async editSkill(name: string, index?: number) {
		if (name !== '') {
			try {
				await this.candidateSkillsService.update(this.skillId, {
					name: name
				});
				this.loadSkills();
				this.toastrService.success(
					'TOASTR.MESSAGE.CANDIDATE_SKILL_UPDATED',
					{
						name
					}
				);
				this.skills.reset();
				this.showEditDiv[index] = !this.showEditDiv[index];
				this.showAddCard = false;
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
	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation(
						'CANDIDATES_PAGE.EDIT_CANDIDATE.NAME'
					),
					type: 'string'
				}
			}
		};
	}
	gridEdit(skill: ISkill) {
		this.showAddCard = true;
		this.skills.patchValue([skill]);
		this.skillId = skill.id;
	}
	cancel(index: number) {
		this.showEditDiv[index] = !this.showEditDiv[index];
		this.skillId = null;
	}
	showCard() {
		this.showAddCard = !this.showAddCard;
		this.form.controls.skills.reset();
	}
	async addSkill() {
		const { id: organizationId, tenantId } = this.selectedOrganization;
		const skillForm = this.form.controls.skills as FormArray;
		if (skillForm.valid) {
			const formValue = { ...skillForm.value[0] };
			try {
				await this.candidateSkillsService.create({
					...formValue,
					candidateId: this.candidateId,
					organizationId,
					tenantId
				});
				this.toastrService.success(
					'TOASTR.MESSAGE.CANDIDATE_SKILL_CREATED',
					{
						name: formValue.name
					}
				);
				this.loadSkills();
			} catch (error) {
				this.toastrError(error);
			}
			this.showAddCard = false;
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

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	/*
	 * Getter for candidate skills form controls array
	 */
	get skills(): FormArray {
		return this.form.get('skills') as FormArray;
	}
}

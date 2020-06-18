import { Component, Input, OnInit } from '@angular/core';
import { Validators, FormBuilder, FormGroup } from '@angular/forms';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import {
	Income,
	Organization,
	Skill,
	OrganizationAwards,
	Language,
	OrganizationLanguages,
	ClientFocusEnum
} from '@gauzy/models';
import { CurrenciesEnum } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { OrganizationAwardsService } from '../../../@core/services/organization-awards.service';
import { OrganizationLanguagesService } from '../../../@core/services/organization-languages.service';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import * as moment from 'moment';

@Component({
	selector: 'ngx-public-page-mutation',
	templateUrl: './public-page-mutation.component.html',
	styleUrls: ['./public-page-mutation.component.scss']
})
export class PublicPageMutationComponent extends TranslationBaseComponent
	implements OnInit {
	income?: Income;
	organization?: Organization;
	currencies = Object.values(CurrenciesEnum);
	client_focus = Object.values(ClientFocusEnum);

	selectedLanguageLevel: string;
	showAddAward: boolean;
	showAddLanguage: boolean;
	awardExist: boolean;
	languageExist: boolean;
	organizationId: string;
	form: FormGroup;
	selectedLanguage: Language;
	awards: OrganizationAwards[];
	organization_languages: OrganizationLanguages[];
	skills: Skill[] = [];
	languages: Language[] = [];
	moment = moment;

	get totalEmployees() {
		return this.form.get('totalEmployees').value;
	}

	get banner() {
		return this.form.get('banner').value;
	}

	get name() {
		return this.form.get('name').value;
	}

	get founded() {
		return this.form.get('founded').value;
	}

	get short_description() {
		return this.form.get('short_description').value;
	}

	get overview() {
		return this.form.get('overview').value;
	}

	@Input('selectedClientFocus')
	selectedClientFocus: any;

	constructor(
		private fb: FormBuilder,
		protected dialogRef: NbDialogRef<PublicPageMutationComponent>,
		private readonly toastrService: NbToastrService,
		private readonly organizationAwardsService: OrganizationAwardsService,
		private readonly organizationLanguagesService: OrganizationLanguagesService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this.loadAwards();
		this.loadLanguages();
	}

	editPublicPage() {
		if (this.form.valid) {
			let formValue = Object.assign(this.form.value);
			if (!formValue.client_focus) {
				formValue.client_focus = this.organization.client_focus;
			}
			if (!!formValue.founded) {
				formValue.registrationDate = moment(
					this.organization.registrationDate
				).year(formValue.founded);
			}
			this.dialogRef.close(formValue);
		}
	}

	close() {
		this.dialogRef.close();
	}

	private _initializeForm() {
		if (this.organization) {
			if (typeof this.organization.client_focus === 'string') {
				this.selectedClientFocus = this.organization.client_focus.split(
					','
				);
			}
			this.organizationId = this.organization.id;
			this.form = this.fb.group({
				name: [this.organization.name, Validators.required],
				banner: this.organization.banner,
				totalEmployees: this.organization.totalEmployees,
				founded: moment(this.organization.registrationDate).format('Y'),
				short_description: this.organization.short_description,
				overview: this.organization.overview,
				show_income: this.organization.show_income,
				show_profits: this.organization.show_profits,
				show_bonuses_paid: this.organization.show_bonuses_paid,
				show_total_hours: this.organization.show_total_hours,
				show_minimum_project_size: this.organization
					.show_minimum_project_size,
				show_projects_count: this.organization.show_projects_count,
				show_clients_count: this.organization.show_clients_count,
				client_focus: [],
				skills: this.organization.skills,
				languages: []
			});
		}
	}

	selectedSkillsHandler(ev: any) {
		this.form.get('skills').setValue(ev);
	}

	selectedClientFocusHandler(ev: any) {
		this.form.get('client_focus').setValue(ev.join(','));
	}

	selectedLanguageHandler(ev: any) {
		this.selectedLanguage = ev;
	}

	private changeShowAction(sel: any) {
		this.form.get(sel).setValue(this.organization[sel]);
	}

	private async addAward(name: string, year: string) {
		if (name && year) {
			await this.organizationAwardsService.create({
				name,
				organizationId: this.organizationId,
				year
			});

			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_AWARDS.ADD_AWARD',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.showAddAward = !this.showAddAward;
			this.loadAwards();
		} else {
			// TODO translate
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_AWARDS.INVALID_AWARD_NAME_YEAR'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_AWARD_INVALID_NAME'
				)
			);
		}
	}

	private async addLanguage(
		language: Language,
		level: string,
		organization: Organization,
		name: string
	) {
		if (language && level && name) {
			await this.organizationLanguagesService.create({
				language,
				level,
				organization,
				name
			});

			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_LANGUAGES.ADD_LANGUAGE',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.showAddLanguage = !this.showAddLanguage;
			this.loadLanguages();
		} else {
			// TODO translate
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_LANGUAGES.INVALID_LANGUAGE_NAME_LEVEL'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_LANGUAGE_INVALID_NAME'
				)
			);
		}
	}

	private async removeAward(id: string) {
		await this.organizationAwardsService.delete(id);
		this.toastrService.primary(
			this.getTranslation(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_AWARDS.REMOVE_AWARD',
				{
					name: name
				}
			),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
		this.loadAwards();
	}

	private async removeLanguage(id: string) {
		await this.organizationLanguagesService.delete(id);
		this.toastrService.primary(
			this.getTranslation(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_LANGUAGES.REMOVE_LANGUAGE',
				{
					name: name
				}
			),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
		this.loadLanguages();
	}

	private async loadAwards() {
		const res = await this.organizationAwardsService.getAll({
			organizationId: this.organizationId
		});
		if (res) {
			this.awards = res.items;

			if (this.awards.length <= 0) {
				this.awardExist = false;
			} else {
				this.awardExist = true;
			}
		}
	}

	private async loadLanguages() {
		const res = await this.organizationLanguagesService.getAll(
			{
				organizationId: this.organizationId
			},
			['Language']
		);
		if (res) {
			this.organization_languages = res.items;

			if (this.organization_languages.length <= 0) {
				this.languageExist = false;
			} else {
				this.languageExist = true;
			}
		}
	}
}

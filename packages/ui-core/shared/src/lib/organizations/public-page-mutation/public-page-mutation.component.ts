import { Component, Input, OnInit } from '@angular/core';
import { Validators, UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { CKEditor4 } from 'ckeditor4-angular/ckeditor';
import * as moment from 'moment';
import {
	IIncome,
	IOrganization,
	ISkill,
	IOrganizationAward,
	ILanguage,
	IOrganizationLanguage,
	ClientFocusEnum,
	MinimumProjectSizeEnum
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { ToastrService } from '@gauzy/ui-core/core';
import { Store } from '@gauzy/ui-core/core';
import { OrganizationAwardsService, OrganizationLanguagesService } from '@gauzy/ui-core/core';
import { ckEditorConfig } from '../../ckeditor.config';

@Component({
	selector: 'ngx-public-page-mutation',
	templateUrl: './public-page-mutation.component.html',
	styleUrls: ['./public-page-mutation.component.scss']
})
export class PublicPageMutationComponent extends TranslationBaseComponent implements OnInit {
	income?: IIncome;
	organization?: IOrganization;
	client_focus = Object.values(ClientFocusEnum);
	minimumProjectSizes = Object.values(MinimumProjectSizeEnum);
	selectedLanguageLevel: string;
	showAddAward: boolean;
	showAddLanguage: boolean;
	awardExist: boolean;
	languageExist: boolean;
	organizationId: string;
	tenantId: string;
	form: UntypedFormGroup;
	selectedLanguage: ILanguage;
	awards: IOrganizationAward[];
	organization_languages: IOrganizationLanguage[];
	skills: ISkill[] = [];
	languages: ILanguage[] = [];
	moment = moment;
	ckConfig: CKEditor4.Config = {
		...ckEditorConfig,
		height: '200'
	};

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
		private readonly fb: UntypedFormBuilder,
		protected readonly dialogRef: NbDialogRef<PublicPageMutationComponent>,
		private readonly toastrService: ToastrService,
		private readonly organizationAwardsService: OrganizationAwardsService,
		private readonly organizationLanguagesService: OrganizationLanguagesService,
		readonly translateService: TranslateService,
		private readonly store: Store
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
			const formValue = Object.assign(this.form.value);
			if (!formValue.client_focus) {
				formValue.client_focus = this.organization.client_focus;
			}
			if (!!formValue.founded) {
				formValue.registrationDate = moment(this.organization.registrationDate).year(formValue.founded);
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
				this.selectedClientFocus = this.organization.client_focus.split(',');
			}
			this.organizationId = this.organization.id;
			this.tenantId = this.store.user.tenantId;
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
				show_minimum_project_size: this.organization.show_minimum_project_size,
				show_projects_count: this.organization.show_projects_count,
				show_clients_count: this.organization.show_clients_count,
				show_clients: this.organization.show_clients,
				show_employees_count: this.organization.show_employees_count,
				client_focus: [],
				skills: this.organization.skills,
				minimumProjectSize: this.organization.minimumProjectSize,
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

	changeShowAction(sel: any) {
		this.form.get(sel).setValue(this.organization[sel]);
	}

	async addAward(name: string, year: string) {
		if (name && year) {
			const { organizationId, tenantId } = this;
			await this.organizationAwardsService.create({
				name,
				organizationId,
				tenantId,
				year
			});

			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_AWARDS.ADD_AWARD', {
				name
			});

			this.showAddAward = !this.showAddAward;
			this.loadAwards();
		} else {
			// TODO translate
			this.toastrService.danger(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_AWARDS.INVALID_AWARD_NAME_YEAR',
				'TOASTR.MESSAGE.NEW_ORGANIZATION_AWARD_INVALID_NAME'
			);
		}
	}

	async addLanguage(language: ILanguage, level: string, organization: IOrganization, name: string) {
		if (language && level && name) {
			const { tenantId } = this;
			await this.organizationLanguagesService.create({
				language,
				level,
				organization,
				tenantId,
				name
			});

			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_LANGUAGES.ADD_LANGUAGE', {
				name
			});

			this.showAddLanguage = !this.showAddLanguage;
			this.loadLanguages();
		} else {
			// TODO translate
			this.toastrService.danger(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_LANGUAGES.INVALID_LANGUAGE_NAME_LEVEL',
				'TOASTR.MESSAGE.NEW_ORGANIZATION_LANGUAGE_INVALID_NAME'
			);
		}
	}

	async removeAward(award) {
		await this.organizationAwardsService.delete(award.id);
		this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_AWARDS.REMOVE_AWARD', {
			name: award.name
		});
		this.loadAwards();
	}

	async removeLanguage(language) {
		await this.organizationLanguagesService.delete(language.id);
		this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_LANGUAGES.REMOVE_LANGUAGE', {
			name: language.name
		});
		this.loadLanguages();
	}

	private async loadAwards() {
		const { organizationId, tenantId } = this;
		const res = await this.organizationAwardsService.getAll({
			organizationId,
			tenantId
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
		const { organizationId, tenantId } = this;
		const res = await this.organizationLanguagesService.getAll({ organizationId, tenantId }, ['language']);
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

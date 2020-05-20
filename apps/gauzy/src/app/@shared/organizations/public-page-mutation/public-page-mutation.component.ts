import { Component, OnInit } from '@angular/core';
import { Validators, FormBuilder, FormGroup } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { Income, Organization, Skill } from '@gauzy/models';
import { CurrenciesEnum } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';

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

	form: FormGroup;

	organizationId: string;

	skills: Skill[] = [];

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

	constructor(
		private fb: FormBuilder,
		protected dialogRef: NbDialogRef<PublicPageMutationComponent>,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
	}

	editPublicPage() {
		if (this.form.valid) {
			this.dialogRef.close(Object.assign(this.form.value));
		}
	}

	close() {
		this.dialogRef.close();
	}

	private _initializeForm() {
		if (this.organization) {
			this.form = this.fb.group({
				name: [this.organization.name, Validators.required],
				banner: this.organization.banner,
				founded: this.organization.founded,
				short_description: this.organization.short_description,
				overview: this.organization.overview,
				skills: []
			});
		}
	}
	selectedSkillsHandler(ev: any) {
		this.form.get('skills').setValue(ev);
	}
}

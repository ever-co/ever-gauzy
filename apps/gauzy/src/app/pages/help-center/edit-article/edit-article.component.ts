import { Component, OnDestroy, Input, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IHelpCenterArticle } from '@gauzy/models';
import { HelpCenterArticleService } from '../../../@core/services/help-center-article.service';

@Component({
	selector: 'ga-edit-article',
	templateUrl: 'edit-article.component.html',
	styleUrls: ['edit-article.component.scss']
})
export class EditArticleComponent extends TranslationBaseComponent
	implements OnDestroy, OnInit {
	@Input() article: IHelpCenterArticle;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<EditArticleComponent>,
		readonly translateService: TranslateService,
		private readonly fb: FormBuilder,
		private helpCenterArticleService: HelpCenterArticleService
	) {
		super(translateService);
	}
	public form: FormGroup;
	public selectedPrivacy: string;
	public isDraft = ['draft', 'publish'];

	ngOnInit() {
		this.form = this.fb.group({
			name: [''],
			desc: [''],
			data: ['']
		});
		this.loadFormData(this.article);
		this.selectedPrivacy = this.article.draft;
	}

	closeDialog() {
		this.dialogRef.close();
	}

	privacySelect(value: string) {
		this.selectedPrivacy = value;
	}

	loadFormData(data) {
		this.form.patchValue({
			name: data.name,
			desc: data.description,
			data: data.data
		});
	}

	async submit() {
		this.article = await this.helpCenterArticleService.update(
			`${this.article.id}`,
			{
				name: `${this.form.value.name}`,
				description: `${this.form.value.desc}`,
				data: `${this.form.value.data}`,
				draft: `${this.selectedPrivacy}`
			}
		);
		this.dialogRef.close(this.article);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

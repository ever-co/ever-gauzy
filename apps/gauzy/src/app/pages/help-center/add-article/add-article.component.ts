import { IHelpCenterArticle } from '@gauzy/models';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { FormBuilder, FormGroup } from '@angular/forms';
import { HelpCenterArticleService } from '../../../@core/services/help-center-article.service';

@Component({
	selector: 'ga-add-article',
	templateUrl: 'add-article.component.html',
	styleUrls: ['add-article.component.scss']
})
export class AddArticleComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<AddArticleComponent>,
		readonly translateService: TranslateService,
		private readonly fb: FormBuilder,
		private helpCenterArticleService: HelpCenterArticleService
	) {
		super(translateService);
	}
	form: FormGroup;
	public data = {
		name: '',
		desc: '',
		data: ''
	};
	public selectedPrivacy = false;
	public selectedStatus = false;
	public article: IHelpCenterArticle = null;
	ngOnInit() {
		this.form = this.fb.group({
			name: [''],
			desc: [''],
			data: ['']
		});
		this.loadFormData(this.data);
	}

	toggleStatus(event: boolean) {
		this.selectedStatus = event;
	}

	togglePrivacy(event: boolean) {
		this.selectedPrivacy = event;
	}

	loadFormData(data) {
		this.form.patchValue({
			name: data.name,
			desc: data.desc,
			data: data.data
		});
	}

	async submit() {
		this.article = await this.helpCenterArticleService.create({
			name: `${this.form.value.name}`,
			description: `${this.form.value.desc}`,
			data: `${this.form.value.data}`,
			draft: this.selectedStatus,
			privacy: this.selectedPrivacy,
			categoryId: 'id'
		});
		this.dialogRef.close(this.article);
	}

	closeDialog() {
		this.dialogRef.close();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

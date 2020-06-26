import { IHelpCenterArticle } from '@gauzy/models';
import { Component, OnDestroy, OnInit, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HelpCenterArticleService } from '../../../@core/services/help-center-article.service';

@Component({
	selector: 'ga-add-article',
	templateUrl: 'add-article.component.html',
	styleUrls: ['add-article.component.scss']
})
export class AddArticleComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@Input() article: IHelpCenterArticle;
	@Input() editType: string;
	@Input() length: number;
	@Input() id: string;
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
		description: '',
		data: ''
	};
	public selectedPrivacy = false;
	public selectedStatus = false;
	ngOnInit() {
		this.form = this.fb.group({
			name: ['', Validators.required],
			desc: ['', Validators.required],
			data: ['', Validators.required]
		});
		if (this.editType === 'add') this.loadFormData(this.data);
		if (this.editType === 'edit') {
			this.loadFormData(this.article);
			this.selectedPrivacy = this.article.privacy;
			this.selectedStatus = this.article.draft;
		}
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
			desc: data.description,
			data: data.data
		});
	}

	async submit() {
		if (this.editType === 'add')
			this.article = await this.helpCenterArticleService.create({
				name: `${this.form.value.name}`,
				description: `${this.form.value.desc}`,
				data: `${this.form.value.data}`,
				draft: this.selectedStatus,
				privacy: this.selectedPrivacy,
				index: this.length,
				categoryId: this.id
			});
		if (this.editType === 'edit') {
			this.article = await this.helpCenterArticleService.update(
				`${this.article.id}`,
				{
					name: `${this.form.value.name}`,
					description: `${this.form.value.desc}`,
					data: `${this.form.value.data}`,
					draft: this.selectedStatus,
					privacy: this.selectedPrivacy
				}
			);
		}
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

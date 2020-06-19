import { Component, OnDestroy, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { FormBuilder, FormGroup } from '@angular/forms';
// import { HelpCenterArticleService } from '../../../@core/services/help-center-article.service';

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
		private readonly fb: FormBuilder // private readonly helpCenterArticleService: HelpCenterArticleService
	) {
		super(translateService);
	}
	form: FormGroup;
	public data = {
		name: '',
		desc: '',
		data: ''
	};
	ngOnInit() {
		this.form = this.fb.group({
			name: [''],
			desc: [''],
			data: ['']
		});
		this.loadFormData(this.data);
	}

	loadFormData(data) {
		this.form.patchValue({
			name: data.name,
			desc: data.desc,
			data: data.data
		});
	}

	async submit() {
		console.log('event', this.form.value);

		// await this.helpService.create({
		// 	name: `${event.target.value}`,
		// 	icon: 'book-open-outline',
		// 	flag: 'category',
		// 	privacy: 'eye-outline',
		// 	language: 'en',
		// 	color: 'black',
		// });
		// this.toastrSuccess('CREATED_CATEGORY');
	}

	closeDialog() {
		this.dialogRef.close();
	}

	OnInit() {
		this.form = this.fb.group({
			name: [''],
			desc: [''],
			data: ['']
		});
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

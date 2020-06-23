import { Component, OnDestroy, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IHelpCenterArticle } from '@gauzy/models';

@Component({
	selector: 'ga-edit-article',
	templateUrl: 'edit-article.component.html',
	styleUrls: ['edit-article.component.scss']
})
export class EditArticleComponent extends TranslationBaseComponent
	implements OnDestroy {
	@Input() article: IHelpCenterArticle;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<EditArticleComponent>,
		readonly translateService: TranslateService,
		private readonly fb: FormBuilder
	) {
		super(translateService);
	}
	form: FormGroup;

	closeDialog() {
		console.log(this.article);
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

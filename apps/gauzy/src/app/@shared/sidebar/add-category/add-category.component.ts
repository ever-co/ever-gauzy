import { Component, OnDestroy, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { IHelpCenter } from '@gauzy/models';
import { HelpCenterService } from '../../../@core/services/help-center.service';
import { FormBuilder, FormGroup } from '@angular/forms';

@Component({
	selector: 'ga-add-category',
	templateUrl: 'add-category.component.html',
	styleUrls: ['add-category.component.scss']
})
export class AddCategoryComponent extends TranslationBaseComponent
	implements OnDestroy {
	@Input() base: IHelpCenter;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<AddCategoryComponent>,
		readonly translateService: TranslateService,
		private helpCenterService: HelpCenterService,
		private readonly fb: FormBuilder
	) {
		super(translateService);
	}
	public parentId: string;
	public selectedLang = '';
	public selectedColor = '';
	public languages = ['en', 'ru', 'he', 'bg'];
	public colors = ['black', 'blue'];
	form: FormGroup;
	public data = {
		name: '',
		desc: ''
	};

	ngOnInit() {
		this.form = this.fb.group({
			name: [''],
			desc: ['']
		});
		this.loadFormData(this.data);
	}

	loadFormData(data) {
		this.form.patchValue({
			name: data.name,
			desc: data.desc
		});
		this.parentId = this.base.id;
	}
	async submit() {
		const res = await this.helpCenterService.create({
			name: `${this.form.value.name}`,
			privacy: 'eye-outline',
			icon: 'book-open-outline',
			flag: 'category',
			index: 0,
			description: `${this.form.value.desc}`,
			language: `${this.selectedLang}`,
			color: `${this.selectedColor}`,
			parentId: `${this.parentId}`
		});

		this.dialogRef.close(res);
	}

	closeDialog() {
		this.dialogRef.close();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

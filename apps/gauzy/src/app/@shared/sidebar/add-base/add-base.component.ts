import { Component, OnDestroy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IHelpCenter } from '@gauzy/models';
import { HelpCenterService } from '../../../@core/services/help-center.service';

@Component({
	selector: 'ga-add-base',
	templateUrl: 'add-base.component.html',
	styleUrls: ['add-base.component.scss']
})
export class AddBaseComponent extends TranslationBaseComponent
	implements OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<AddBaseComponent>,
		readonly translateService: TranslateService,
		private helpCenterService: HelpCenterService,
		private readonly fb: FormBuilder
	) {
		super(translateService);
	}
	public selectedLang = '';
	public selectedColor = '';
	public languages = ['en', 'ru', 'he', 'bg'];
	public colors = ['black', 'blue'];
	form: FormGroup;
	public data = {
		name: '',
		desc: ''
	};
	public base: IHelpCenter = null;

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
	}

	async submit() {
		this.base = await this.helpCenterService.create({
			name: `${this.form.value.name}`,
			privacy: 'eye-outline',
			icon: 'book-open-outline',
			flag: 'base',
			index: 0,
			description: `${this.form.value.desc}`,
			language: `${this.selectedLang}`,
			color: `${this.selectedColor}`,
			children: []
		});
		this.dialogRef.close(this.base);
	}

	closeDialog() {
		this.dialogRef.close();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

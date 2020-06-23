import { Component, OnDestroy, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { IHelpCenter } from '@gauzy/models';
import { FormGroup, FormBuilder } from '@angular/forms';
import { HelpCenterService } from '../../../@core/services/help-center.service';

@Component({
	selector: 'ga-edit-base',
	templateUrl: 'edit-base.component.html',
	styleUrls: ['edit-base.component.scss']
})
export class EditBaseComponent extends TranslationBaseComponent
	implements OnDestroy {
	@Input() base: IHelpCenter;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<EditBaseComponent>,
		readonly translateService: TranslateService,
		private helpCenterService: HelpCenterService,
		private readonly fb: FormBuilder
	) {
		super(translateService);
	}
	public selectedLang: string;
	public selectedColor: string;
	public languages = ['en', 'ru', 'he', 'bg'];
	public colors = ['black', 'blue'];
	form: FormGroup;

	ngOnInit() {
		this.selectedLang = this.base.language;
		this.selectedColor = this.base.color;
		this.form = this.fb.group({
			name: [''],
			desc: ['']
		});
		this.loadFormData(this.base);
	}

	loadFormData(base) {
		this.form.patchValue({
			name: base.name,
			desc: base.description
		});
	}

	async submit() {
		this.base = await this.helpCenterService.update(this.base.id, {
			name: `${this.form.value.name}`,
			description: `${this.form.value.desc}`,
			language: `${this.selectedLang}`,
			color: `${this.selectedColor}`
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

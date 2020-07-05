import { Component, OnDestroy, Input, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { IHelpCenter } from '@gauzy/models';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { HelpCenterService } from '../../../@core/services/help-center.service';

@Component({
	selector: 'ga-edit-base',
	templateUrl: 'edit-base.component.html',
	styleUrls: ['edit-base.component.scss']
})
export class EditBaseComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@Input() base?: IHelpCenter;
	@Input() editType: string;
	@Input() organizationId: string;
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<EditBaseComponent>,
		readonly translateService: TranslateService,
		private helpCenterService: HelpCenterService,
		private readonly fb: FormBuilder
	) {
		super(translateService);
	}
	public color: string;
	public selectedLang = '';
	public selectedIcon = '';
	public isToggled = false;
	public icons = [
		'book-open-outline',
		'archive-outline',
		'alert-circle-outline',
		'attach-outline'
	];
	public languages = ['en', 'ru', 'he', 'bg'];
	public form: FormGroup;

	ngOnInit() {
		if (this.editType === 'edit') {
			this.selectedLang = this.base.language;
			this.selectedIcon = this.base.icon;
			this.isToggled = this.base.privacy === 'eye-outline' ? true : false;
		}
		this.form = this.fb.group({
			name: ['', Validators.required],
			color: [''],
			desc: ['', Validators.required]
		});
		this.loadFormData();
	}

	toggleStatus(event: boolean) {
		this.isToggled = event;
	}

	loadFormData() {
		if (this.editType === 'edit')
			this.form.patchValue({
				name: this.base.name,
				desc: this.base.description,
				color: this.base.color
			});
		if (this.editType === 'add')
			this.form.patchValue({
				name: '',
				desc: '',
				color: '#000000'
			});
	}

	async submit() {
		if (this.editType === 'edit')
			this.base = await this.helpCenterService.update(this.base.id, {
				name: `${this.form.value.name}`,
				description: `${this.form.value.desc}`,
				language: `${this.selectedLang}`,
				color: `${this.color}`,
				icon: `${this.selectedIcon}`,
				privacy:
					this.isToggled === true ? 'eye-outline' : 'eye-off-outline'
			});
		if (this.editType === 'add')
			this.base = await this.helpCenterService.create({
				name: `${this.form.value.name}`,
				privacy:
					this.isToggled === true ? 'eye-outline' : 'eye-off-outline',
				icon: `${this.selectedIcon}`,
				flag: 'base',
				index: 0,
				organizationId: this.organizationId,
				description: `${this.form.value.desc}`,
				language: `${this.selectedLang}`,
				color: `${this.color}`,
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

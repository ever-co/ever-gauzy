import { Component, OnDestroy, Input, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { IHelpCenter, LanguagesEnum } from '@gauzy/contracts';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { HelpCenterService, Store } from '../../../@core';

@Component({
	selector: 'ga-edit-base',
	templateUrl: 'edit-base.component.html',
	styleUrls: ['edit-base.component.scss']
})
export class EditBaseComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	@Input() base?: IHelpCenter;
	@Input() editType: string;

	static buildForm(formBuilder: FormBuilder): FormGroup {
		const form = formBuilder.group({
			name: ['', Validators.required],
			color: ['#000000'],
			description: [],
			language: ['', Validators.required],
			icon: [],
			privacy: [false]
		});
		return form;
	}

	constructor(
		protected dialogRef: NbDialogRef<EditBaseComponent>,
		readonly translateService: TranslateService,
		private helpCenterService: HelpCenterService,
		private readonly formBuilder: FormBuilder,
		private readonly store: Store
	) {
		super(translateService);
	}

	public icons = [
		'book-open-outline',
		'archive-outline',
		'alert-circle-outline',
		'attach-outline'
	];
	public form: FormGroup;

	ngOnInit() {
		this.form = EditBaseComponent.buildForm(this.formBuilder);
		if (this.editType === 'edit') {
			this.patchValue();
		}
	}

	toggleStatus(event: boolean) {
		this.form.patchValue({ 
			privacy: event 
		});
	}

	selectedLanguage(event) {
		this.form.patchValue({ 
			language: event.code 
		});
	}

	changedColor(event) {
		this.form.patchValue({ 
			color: event 
		});
	}

	patchValue() {
		this.form.setValue({
			name: this.base.name,
			description: this.base.description,
			color: this.base.color,
			language: this.base.language,
			icon: this.base.icon,
			privacy: (this.base.privacy === 'eye-outline') ? true : false
		});
		this.form.updateValueAndValidity();	
	}

	async submit() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;
		const { name, description, language, privacy, icon, color } = this.form.value;
		const contextRequest = {
			name,
			description,
			language,
			color,
			icon,
			organizationId,
			tenantId,
			privacy: privacy === true ? 'eye-outline' : 'eye-off-outline',
		}

		if (this.editType === 'edit') {
			this.base = await this.helpCenterService.update(this.base.id, { ...contextRequest });
		} else {
			this.base = await this.helpCenterService.create({
				...{ flag: 'base', index: 0, children: [] },
				...contextRequest
			});
		}
		this.dialogRef.close(this.base);
	}

	closeDialog() {
		this.dialogRef.close();
	}

	/**
	* Getter for privacy form control value
	*/
	get language() {
		return this.form.get('language').value;
	}

	/**
	* Getter for privacy form control value
	*/
	get privacy() {
		return this.form.get('privacy').value;
	}

	/**
	* Getter for color form control value
	*/
	get color() {
		return this.form.get('color').value;
	}

	/**
	* Getter for icon form control value
	*/
	get icon() {
		return this.form.get('icon').value;
	}

	ngOnDestroy() {}
}

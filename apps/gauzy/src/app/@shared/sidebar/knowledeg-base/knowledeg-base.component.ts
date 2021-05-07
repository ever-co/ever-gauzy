import { Component, OnDestroy, Input, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { IHelpCenter } from '@gauzy/contracts';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { HelpCenterService, Store } from '../../../@core';

export enum ActionEnum {
	ADD = 'add',
	EDIT = 'edit'
}

export enum FlagEnum {
	BASE = 'base',
	CATEGORY = 'category'
}

@Component({
	selector: 'ga-knowledeg-base-mutation',
	templateUrl: './knowledeg-base.component.html',
	styleUrls: ['./knowledeg-base.component.scss']
})
export class KnowledgeBaseComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	@Input() base?: IHelpCenter;
	@Input() editType: string;

	flagEnum = FlagEnum;
	actionEnum = ActionEnum;

	/*
	* Getter & Setter for flag (Base, Category)
	*/
	private _flag: string;
	get flag(): string {
		return this._flag;
	}
	@Input() set flag(value: string) {
		this._flag = value;
	}

	/*
	* Getter & Setter for parentId
	*/
	private _parentId: string;
	get parentId(): string {
		return this._parentId;
	}
	@Input() set parentId(value: string) {
		this._parentId = value;
	}

	static buildForm(formBuilder: FormBuilder): FormGroup {
		const form = formBuilder.group({
			name: ['', Validators.required],
			color: ['#d53636'],
			description: [],
			language: ['', Validators.required],
			icon: ['', Validators.required],
			privacy: [false]
		});
		return form;
	}

	constructor(
		protected dialogRef: NbDialogRef<KnowledgeBaseComponent>,
		readonly translateService: TranslateService,
		private helpCenterService: HelpCenterService,
		private readonly formBuilder: FormBuilder,
		private readonly store: Store
	) {
		super(translateService);
	}

	public form: FormGroup = KnowledgeBaseComponent.buildForm(this.formBuilder);
	public icons = [
		{
			label: 'Book Open',
			value: 'book-open-outline'
		},
		{
			label: 'Archive',
			value: 'archive-outline'
		},
		{
			label: 'Alert Circle',
			value: 'alert-circle-outline'
		},
		{
			label: 'Attach',
			value: 'attach-outline'
		},
	];

	ngOnInit() {
		if (this.editType === ActionEnum.EDIT) {
			this.patchValue(this.base);
		}
	}

	togglePrivacy(event: boolean) {
		this.form.patchValue({ 
			privacy: event 
		});
	}

	selectedLanguage(event) {
		this.form.patchValue({ 
			language: event.code 
		});
	}

	selectedColor(event) {
		this.form.patchValue({ 
			color: event 
		});
	}

	patchValue(data: any) {
 		const { name, description, color, language, icon, privacy } = data;
		const selectedIcon = this.icons.find((item) => item.value === icon);
		this.form.setValue({ 
			name, 
			description, 
			color, 
			language, 
			icon: selectedIcon,
			privacy: (privacy === 'eye-outline') ? true : false
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
			icon: icon.value,
			organizationId,
			tenantId,
			privacy: privacy === true ? 'eye-outline' : 'eye-off-outline',
		}

		if (this.editType === ActionEnum.EDIT) {
			this.base = await this.helpCenterService.update(
				this.base.id, 
				{ ...contextRequest }
			);
		} else {
			this.base = await this.helpCenterService.create({
				...{ flag: this.flag, index: 0, children: [], parentId: this.parentId },
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

	isInvalidControl(control: string) {
		if (!this.form.contains(control)) {
			return true;
		}
		return this.form.get(control).touched && this.form.get(control).invalid;
	}

	ngOnDestroy() {}
}

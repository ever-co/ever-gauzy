import { Component, OnDestroy, Input, OnInit } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators, AbstractControl } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { HelpCenterActionEnum, HelpCenterFlagEnum, IHelpCenter, ILanguage } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { Store } from '@gauzy/ui-core/core';
import { HelpCenterService } from '@gauzy/ui-core/core';

@Component({
	selector: 'ga-knowledeg-base-mutation',
	templateUrl: './knowledeg-base.component.html',
	styleUrls: ['./knowledeg-base.component.scss']
})
export class KnowledgeBaseComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	@Input() base?: IHelpCenter;
	@Input() editType: string;

	flagEnum = HelpCenterFlagEnum;
	actionEnum = HelpCenterActionEnum;

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

	static buildForm(formBuilder: UntypedFormBuilder): UntypedFormGroup {
		const form = formBuilder.group({
			name: ['', Validators.compose([Validators.required, Validators.maxLength(255)])],
			color: ['#d53636'],
			description: ['', Validators.maxLength(255)],
			language: ['', Validators.required],
			icon: ['', Validators.required],
			privacy: [false]
		});
		return form;
	}

	constructor(
		protected readonly dialogRef: NbDialogRef<KnowledgeBaseComponent>,
		public readonly translateService: TranslateService,
		private readonly helpCenterService: HelpCenterService,
		private readonly formBuilder: UntypedFormBuilder,
		private readonly store: Store
	) {
		super(translateService);
	}

	public form: UntypedFormGroup = KnowledgeBaseComponent.buildForm(this.formBuilder);
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
		}
	];

	ngOnInit() {
		if (this.editType === HelpCenterActionEnum.EDIT) {
			this.patchValue(this.base);
		}
	}

	togglePrivacy(event: boolean) {
		this.form.patchValue({
			privacy: event
		});
	}

	selectedLanguage(event: ILanguage) {
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
			privacy: privacy === 'eye-outline' ? true : false
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
			privacy: privacy === true ? 'eye-outline' : 'eye-off-outline'
		};

		if (this.editType === HelpCenterActionEnum.EDIT) {
			this.base = await this.helpCenterService.update(this.base.id, { ...contextRequest });
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

	public get name(): AbstractControl {
		return this.form.get('name');
	}

	public get description(): AbstractControl {
		return this.form.get('description');
	}

	isInvalidControl(control: string) {
		if (!this.form.contains(control)) {
			return true;
		}
		return this.form.get(control).touched && this.form.get(control).invalid;
	}

	ngOnDestroy() {}
}

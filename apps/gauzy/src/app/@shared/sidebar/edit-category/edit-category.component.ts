import { IHelpCenter } from '@gauzy/models';
import { Component, OnDestroy, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { HelpCenterService } from '../../../@core/services/help-center.service';

@Component({
	selector: 'ga-edit-category',
	templateUrl: 'edit-category.component.html',
	styleUrls: ['edit-category.component.scss']
})
export class EditCategoryComponent extends TranslationBaseComponent
	implements OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	constructor(
		protected dialogRef: NbDialogRef<EditCategoryComponent>,
		readonly translateService: TranslateService,
		private helpCenterService: HelpCenterService,
		private readonly fb: FormBuilder
	) {
		super(translateService);
	}
	@Input() category?: IHelpCenter;
	@Input() base: IHelpCenter;
	@Input() editType: string;
	@Input() organizationId: string;
	public selectedLang: string;
	public isToggled = false;
	public selectedIcon: string;
	public icons = [
		'book-open-outline',
		'archive-outline',
		'alert-circle-outline',
		'attach-outline'
	];
	public languages = ['en', 'ru', 'he', 'bg'];
	public parentId: string;
	public color: string;
	public form: FormGroup;

	ngOnInit() {
		if (this.editType === 'edit') {
			this.isToggled =
				this.category.privacy === 'eye-outline' ? true : false;
			this.selectedLang = this.category.language;
			this.selectedIcon = this.category.icon;
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
				name: this.category.name,
				desc: this.category.description,
				color: this.category.color
			});
		if (this.editType === 'add') {
			this.form.patchValue({
				name: '',
				desc: '',
				color: '#000000'
			});
			this.parentId = this.base.id;
		}
	}

	async submit() {
		if (this.editType === 'edit')
			this.category = await this.helpCenterService.update(
				this.category.id,
				{
					name: `${this.form.value.name}`,
					description: `${this.form.value.desc}`,
					language: `${this.selectedLang}`,
					color: `${this.color}`,
					icon: `${this.selectedIcon}`,
					privacy:
						this.isToggled === true
							? 'eye-outline'
							: 'eye-off-outline'
				}
			);
		if (this.editType === 'add')
			this.category = await this.helpCenterService.create({
				name: `${this.form.value.name}`,
				privacy:
					this.isToggled === true ? 'eye-outline' : 'eye-off-outline',
				icon: `${this.selectedIcon}`,
				flag: 'category',
				index: 0,
				organizationId: this.organizationId,
				description: `${this.form.value.desc}`,
				language: `${this.selectedLang}`,
				color: `${this.color}`,
				parentId: `${this.parentId}`
			});
		this.dialogRef.close(this.category);
	}

	closeDialog() {
		this.dialogRef.close();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}

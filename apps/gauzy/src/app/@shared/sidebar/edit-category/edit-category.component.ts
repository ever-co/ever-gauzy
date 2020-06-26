import { IHelpCenter } from '@gauzy/models';
import { Component, OnDestroy, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Subject } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { FormGroup, FormBuilder } from '@angular/forms';
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
	@Input() category: IHelpCenter;
	public selectedLang: string;
	public selectedColor: string;
	public selectedStatus: string;
	public selectedIcon: string;
	public icons = [
		'book-open-outline',
		'archive-outline',
		'alert-circle-outline',
		'attach-outline'
	];
	public isDraft = ['draft', 'publish'];
	public languages = ['en', 'ru', 'he', 'bg'];
	public colors = ['black', 'blue'];
	public form: FormGroup;

	ngOnInit() {
		this.selectedStatus =
			this.category.privacy === 'eye-outline' ? 'publish' : 'draft';
		this.selectedLang = this.category.language;
		this.selectedColor = this.category.color;
		this.selectedIcon = this.category.icon;
		this.form = this.fb.group({
			name: [''],
			desc: ['']
		});
		this.loadFormData(this.category);
	}

	loadFormData(category) {
		this.form.patchValue({
			name: category.name,
			desc: category.description
		});
	}

	async submit() {
		this.category = await this.helpCenterService.update(this.category.id, {
			name: `${this.form.value.name}`,
			description: `${this.form.value.desc}`,
			language: `${this.selectedLang}`,
			color: `${this.selectedColor}`,
			icon: `${this.selectedIcon}`,
			privacy:
				this.selectedStatus === 'publish'
					? 'eye-outline'
					: 'eye-off-outline'
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

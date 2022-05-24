import { Component, Input, OnInit } from '@angular/core';
import {
	FormBuilder,
	FormGroup,
	Validators
} from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import {
	ITag,
	IOrganization,
	IExpenseCategory
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { Store } from './../../../../@core/services';
import { TranslationBaseComponent } from './../../../../@shared/language-base';
import { FormHelpers } from './../../../../@shared/forms';
import { filter, tap } from 'rxjs/operators';


@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-expense-category-mutation',
	templateUrl: './expense-category-mutation.component.html',
	styleUrls: ['./expense-category-mutation.component.scss']
})
export class ExpenseCategoryMutationComponent extends TranslationBaseComponent 
	implements OnInit {

	FormHelpers: typeof FormHelpers = FormHelpers;
	public organization: IOrganization;

	/*
	* Getter & Setter category element
	*/
	_category: IExpenseCategory;
	get category(): IExpenseCategory {
		return this._category;
	}
	@Input() set category(value: IExpenseCategory) {
		this._category = value;
	}

	/*
	* Expense Category Mutation Form
	*/
	public form: FormGroup = ExpenseCategoryMutationComponent.buildForm(this.fb);
	static buildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			name: ['', Validators.required],
			tags: []
		});
	}

	constructor(
		private readonly fb: FormBuilder,
		protected readonly dialogRef: NbDialogRef<ExpenseCategoryMutationComponent>,
		readonly translateService: TranslateService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => this.organization = organization),
				tap(() => this._patchFormValue()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	close() {
		this.dialogRef.close();
	}

	private _patchFormValue() {
		if (this.category) {
			const { name, tags } = this.category;
			this.form.setValue({ name, tags });
			this.form.updateValueAndValidity();
		}
	}

	selectedTagsHandler(tags: ITag[]) {
		this.form.get('tags').setValue(tags);
		this.form.get('tags').updateValueAndValidity();
	}

	addOrEditCategory() {
		if (this.form.invalid) {
			return;
		}
		this.dialogRef.close(Object.assign({}, this.form.getRawValue()));
	}
}

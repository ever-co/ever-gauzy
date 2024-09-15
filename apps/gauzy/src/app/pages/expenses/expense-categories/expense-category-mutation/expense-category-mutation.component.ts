import { Component, Input, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { ITag, IOrganization, IExpenseCategory } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { FormHelpers } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-expense-category-mutation',
	templateUrl: './expense-category-mutation.component.html',
	styleUrls: ['./expense-category-mutation.component.scss']
})
export class ExpenseCategoryMutationComponent extends TranslationBaseComponent implements OnInit {
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
	public form: UntypedFormGroup = ExpenseCategoryMutationComponent.buildForm(this.fb);
	static buildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			name: ['', Validators.required],
			tags: []
		});
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
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
				tap((organization: IOrganization) => (this.organization = organization)),
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

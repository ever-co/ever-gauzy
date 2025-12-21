import { ChangeDetectionStrategy, Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NB_DIALOG_CONFIG, NbDialogRef } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { asyncScheduler, filter, pairwise, tap } from 'rxjs';
import { IPluginCategoryCreateInput, PluginCategoryActions } from '../../+state/actions/plugin-category.action';
import { PluginCategoryQuery } from '../../+state/queries/plugin-category.query';

export interface CreateCategoryDialogData {
	pluginId?: string;
}

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gauzy-create-category-dialog',
	templateUrl: './create-category-dialog.component.html',
	styleUrls: ['./create-category-dialog.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class CreateCategoryDialogComponent implements OnInit {
	public categoryForm: FormGroup;
	public submitting = false;
	public data: CreateCategoryDialogData;
	public name: string;

	// Color presets for quick selection
	public readonly colorPresets = [
		'#3366FF',
		'#00D68F',
		'#FFAA00',
		'#FF3D71',
		'#A461D8',
		'#00C7E6',
		'#FF6B72',
		'#FFC94D'
	];

	// Icon presets for quick selection
	public readonly iconPresets = [
		'folder-outline',
		'cube-outline',
		'star-outline',
		'heart-outline',
		'award-outline',
		'briefcase-outline',
		'bookmark-outline',
		'grid-outline'
	];

	constructor(
		@Inject(NB_DIALOG_CONFIG) config: { data: CreateCategoryDialogData },
		private readonly dialogRef: NbDialogRef<CreateCategoryDialogComponent>,
		private readonly formBuilder: FormBuilder,
		private readonly actions: Actions,
		private readonly query: PluginCategoryQuery
	) {
		this.data = config.data || {};
		this.initializeForm();
	}

	ngOnInit(): void {
		// Set name if provided
		this.categoryForm.patchValue({ name: this.name });
		// Listen for form submission  errors
		this.query.error$
			.pipe(
				filter((error) => !!error && this.submitting),
				tap(() => (this.submitting = false)),
				untilDestroyed(this)
			)
			.subscribe();
		// Listen for successful category creation (transition from creating=true to creating=false)
		this.query.isCreating$
			.pipe(
				pairwise(),
				filter(([wasCreating, isCreating]) => wasCreating && !isCreating),
				tap(() => {
					const newCategory = this.query.categories[this.query.categories.length - 1];
					if (newCategory) {
						asyncScheduler.schedule(() => {
							this.dialogRef.close(newCategory);
						}, 100);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private initializeForm(): void {
		this.categoryForm = this.formBuilder.group({
			name: ['', [Validators.required, Validators.maxLength(100)]],
			description: ['', Validators.maxLength(500)],
			slug: ['', [Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
			color: ['#3366FF'],
			icon: ['folder-outline'],
			order: [0, [Validators.min(0)]],
			parentId: [null]
		});

		// Auto-generate slug from name
		this.categoryForm
			.get('name')
			?.valueChanges.pipe(
				tap((name: string) => {
					if (name && !this.categoryForm.get('slug')?.dirty) {
						const slug = name
							.toLowerCase()
							.replace(/[^a-z0-9]+/g, '-')
							.replace(/(^-|-$)/g, '');
						this.categoryForm.patchValue({ slug }, { emitEvent: false });
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public onSubmit(): void {
		if (this.categoryForm.valid && !this.submitting) {
			this.submitting = true;
			const formValue = this.categoryForm.value;

			const newCategory: IPluginCategoryCreateInput = {
				name: formValue.name,
				description: formValue.description,
				slug: formValue.slug,
				color: formValue.color,
				icon: formValue.icon,
				order: formValue.order || 0,
				parentId: formValue.parentId || null
			};

			this.actions.dispatch(PluginCategoryActions.create(newCategory));
		} else {
			this.categoryForm.markAllAsTouched();
		}
	}

	public selectColor(color: string): void {
		this.categoryForm.patchValue({ color });
	}

	public selectIcon(icon: string): void {
		this.categoryForm.patchValue({ icon });
	}

	public cancel(): void {
		this.dialogRef.close(null);
	}

	public get selectedColor(): string {
		return this.categoryForm.get('color')?.value || '#3366FF';
	}

	public get selectedIcon(): string {
		return this.categoryForm.get('icon')?.value || 'folder-outline';
	}
}

import { ChangeDetectionStrategy, Component, inject, Input, OnInit, ViewChild } from '@angular/core';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, tap } from 'rxjs';
import { PluginCategoryActions, PluginCategoryQuery } from '../../+state';
import { CategorySelectorComponent } from '../../plugin-marketplace-item/category-selector/category-selector.component';
import { BasePluginFormComponent } from '../base-plugin-form/base-plugin-form.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'lib-plugin-basic-information',
	templateUrl: './plugin-basic-information.component.html',
	styleUrls: ['./plugin-basic-information.component.scss'],
	standalone: false,
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class PluginBasicInformationComponent extends BasePluginFormComponent implements OnInit {
	@Input() pluginTypes: string[];
	@Input() pluginStatuses: string[];
	@ViewChild(CategorySelectorComponent) categorySelector: CategorySelectorComponent;

	private readonly categoryQuery = inject(PluginCategoryQuery);
	private readonly actions = inject(Actions);

	ngOnInit(): void {
		// Listen to category selection changes and update form
		this.categoryQuery.selectedCategory$
			.pipe(
				filter((category) => !!category),
				tap((category) => {
					this.form?.get('categoryId')?.setValue(category.id);
				}),
				untilDestroyed(this)
			)
			.subscribe();

		// Set initial category if editing
		const initialCategoryId = this.form?.get('categoryId')?.value;
		if (initialCategoryId) {
			const category = this.categoryQuery.getCategoryById(initialCategoryId);
			if (category) {
				this.actions.dispatch(PluginCategoryActions.selectCategory(category));
			}
		}
	}

	/**
	 * Get badge color based on plugin status
	 */
	getStatusBadgeColor(status: string): string {
		const statusColorMap: Record<string, string> = {
			active: 'success',
			inactive: 'warning',
			deprecated: 'danger',
			beta: 'info',
			alpha: 'basic'
		};
		return statusColorMap[status?.toLowerCase()] || 'basic';
	}

	/**
	 * Get hint color based on plugin status
	 */
	getStatusHintColor(status: string): string {
		const statusHintMap: Record<string, string> = {
			active: 'success',
			inactive: 'warning',
			deprecated: 'danger',
			beta: 'info',
			alpha: 'basic'
		};
		return statusHintMap[status?.toLowerCase()] || 'basic';
	}
}

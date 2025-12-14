import { ChangeDetectionStrategy, Component, inject, Input, OnInit, ViewChild } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChanged, filter, map, tap } from 'rxjs';
import { PluginCategoryQuery } from '../../+state';
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

	ngOnInit(): void {
		this.syncCategoryWithForm();
	}

	public syncCategoryWithForm(): void {
		const categoryControl = this.form.get('categoryId');

		if (!categoryControl) {
			throw new Error('categoryId control is required');
		}

		this.categoryQuery.selectedCategory$
			.pipe(
				filter((category) => !!category),
				map(({ id }) => id),
				distinctUntilChanged(),
				filter((categoryId) => categoryId !== categoryControl.value),
				tap((categoryId) => categoryControl.setValue(categoryId, { emitEvent: false })),
				untilDestroyed(this)
			)
			.subscribe();
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

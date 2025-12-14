import { AfterViewInit, ChangeDetectionStrategy, Component, inject, Input, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
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
export class PluginBasicInformationComponent extends BasePluginFormComponent implements AfterViewInit {
	@Input() pluginTypes: string[];
	@Input() pluginStatuses: string[];
	@ViewChild(CategorySelectorComponent) categorySelector: CategorySelectorComponent;

	private readonly categoryQuery = inject(PluginCategoryQuery);

	ngAfterViewInit(): void {
		this.initializeForm();
		this.syncCategoryWithForm();
	}

	private initializeForm(): void {
		const categoryId = this.category.value;
		if (categoryId) {
			this.categorySelector.onCategoryChange(categoryId);
		}
	}

	private syncCategoryWithForm(): void {
		this.categoryQuery.selectedCategory$
			.pipe(
				filter(Boolean),
				map((category) => category.id),
				filter((categoryId) => categoryId !== this.category.value),
				distinctUntilChanged(),
				tap((categoryId) => this.category.setValue(categoryId, { emitEvent: false })),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public get category(): FormControl<string> {
		return this.form.get('categoryId') as FormControl<string>;
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

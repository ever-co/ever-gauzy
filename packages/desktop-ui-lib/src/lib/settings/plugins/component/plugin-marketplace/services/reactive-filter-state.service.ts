import { Injectable } from '@angular/core';
import { PluginStatus } from '@gauzy/contracts';
import { BehaviorSubject, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, shareReplay } from 'rxjs/operators';
import { IPluginFilter } from '../+state/stores/plugin-market.store';

/**
 * Command Pattern: Encapsulate filter operations as command objects
 */
export interface IFilterCommand {
	execute(currentFilter: IPluginFilter): IPluginFilter;
	canUndo(): boolean;
	undo(currentFilter: IPluginFilter): IPluginFilter;
}

/**
 * Set Search Command
 */
export class SetSearchCommand implements IFilterCommand {
	private previousValue?: string;

	constructor(private readonly search: string) {}

	execute(currentFilter: IPluginFilter): IPluginFilter {
		this.previousValue = currentFilter.search;
		return { ...currentFilter, search: this.search || undefined };
	}

	canUndo(): boolean {
		return this.previousValue !== undefined;
	}

	undo(currentFilter: IPluginFilter): IPluginFilter {
		return { ...currentFilter, search: this.previousValue };
	}
}

/**
 * Set Categories Command
 */
export class SetCategoriesCommand implements IFilterCommand {
	private previousValue?: string[];

	constructor(private readonly categories: string[]) {}

	execute(currentFilter: IPluginFilter): IPluginFilter {
		this.previousValue = currentFilter.categories;
		return { ...currentFilter, categories: this.categories.length ? this.categories : undefined };
	}

	canUndo(): boolean {
		return this.previousValue !== undefined;
	}

	undo(currentFilter: IPluginFilter): IPluginFilter {
		return { ...currentFilter, categories: this.previousValue };
	}
}

/**
 * Toggle Category Command
 */
export class ToggleCategoryCommand implements IFilterCommand {
	constructor(private readonly categoryId: string) {}

	execute(currentFilter: IPluginFilter): IPluginFilter {
		const categories = currentFilter.categories || [];
		const index = categories.indexOf(this.categoryId);

		const newCategories = [...categories];
		if (index > -1) {
			newCategories.splice(index, 1);
		} else {
			newCategories.push(this.categoryId);
		}

		return { ...currentFilter, categories: newCategories.length ? newCategories : undefined };
	}

	canUndo(): boolean {
		return true;
	}

	undo(currentFilter: IPluginFilter): IPluginFilter {
		// Undo by executing the same toggle
		return this.execute(currentFilter);
	}
}

/**
 * Set Status Command
 */
export class SetStatusCommand implements IFilterCommand {
	private previousValue?: PluginStatus[];

	constructor(private readonly status: PluginStatus[]) {}

	execute(currentFilter: IPluginFilter): IPluginFilter {
		this.previousValue = currentFilter.status;
		return { ...currentFilter, status: this.status.length ? this.status : undefined };
	}

	canUndo(): boolean {
		return this.previousValue !== undefined;
	}

	undo(currentFilter: IPluginFilter): IPluginFilter {
		return { ...currentFilter, status: this.previousValue };
	}
}

/**
 * Clear Filters Command
 */
export class ClearFiltersCommand implements IFilterCommand {
	private previousFilter?: IPluginFilter;

	execute(currentFilter: IPluginFilter): IPluginFilter {
		this.previousFilter = { ...currentFilter };
		return {
			sortBy: currentFilter.sortBy,
			sortDirection: currentFilter.sortDirection
		};
	}

	canUndo(): boolean {
		return this.previousFilter !== undefined;
	}

	undo(currentFilter: IPluginFilter): IPluginFilter {
		return { ...this.previousFilter! };
	}
}

/**
 * Reactive Filter State Service
 * Implements Observer pattern for reactive state management
 * Single Responsibility: Manages filter state and change notifications
 */
@Injectable({
	providedIn: 'root'
})
export class ReactiveFilterStateService {
	// State subject - internal state management
	private readonly filterSubject = new BehaviorSubject<IPluginFilter>(this.getDefaultFilter());

	// Command history for undo functionality
	private readonly commandHistory: IFilterCommand[] = [];
	private readonly maxHistorySize = 10;

	// Public observables with debounce and distinct
	public readonly filter$: Observable<IPluginFilter> = this.filterSubject.asObservable().pipe(
		debounceTime(300),
		distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
		shareReplay(1)
	);

	// Immediate filter changes without debounce (for UI updates)
	public readonly filterImmediate$: Observable<IPluginFilter> = this.filterSubject.asObservable().pipe(
		distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
		shareReplay(1)
	);

	// Derived observables
	public readonly search$: Observable<string | undefined> = this.filterSubject.pipe(
		map((filter) => filter.search),
		distinctUntilChanged()
	);

	public readonly categories$: Observable<string[] | undefined> = this.filterSubject.pipe(
		map((filter) => filter.categories),
		distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
	);

	public readonly status$: Observable<string[] | undefined> = this.filterSubject.pipe(
		map((filter) => filter.status),
		distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
	);

	public readonly types$: Observable<string[] | undefined> = this.filterSubject.pipe(
		map((filter) => filter.types),
		distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
	);

	public readonly hasActiveFilters$: Observable<boolean> = this.filterSubject.pipe(
		map((filter) => this.hasActiveFilters(filter)),
		distinctUntilChanged()
	);

	public readonly activeFilterCount$: Observable<number> = this.filterSubject.pipe(
		map((filter) => this.countActiveFilters(filter)),
		distinctUntilChanged()
	);

	/**
	 * Execute a filter command
	 */
	public executeCommand(command: IFilterCommand): void {
		const currentFilter = this.filterSubject.value;
		const newFilter = command.execute(currentFilter);

		// Add to history
		this.commandHistory.push(command);
		if (this.commandHistory.length > this.maxHistorySize) {
			this.commandHistory.shift();
		}

		this.filterSubject.next(newFilter);
	}

	/**
	 * Undo last command
	 */
	public undoLastCommand(): void {
		const lastCommand = this.commandHistory.pop();
		if (lastCommand && lastCommand.canUndo()) {
			const currentFilter = this.filterSubject.value;
			const previousFilter = lastCommand.undo(currentFilter);
			this.filterSubject.next(previousFilter);
		}
	}

	/**
	 * Get current filter value
	 */
	public getCurrentFilter(): IPluginFilter {
		return this.filterSubject.value;
	}

	/**
	 * Set entire filter state
	 */
	public setFilter(filter: IPluginFilter): void {
		this.filterSubject.next(filter);
	}

	/**
	 * Update filter partially
	 */
	public updateFilter(partial: Partial<IPluginFilter>): void {
		const currentFilter = this.filterSubject.value;
		this.filterSubject.next({ ...currentFilter, ...partial });
	}

	/**
	 * Reset to default filter
	 */
	public resetFilter(): void {
		this.executeCommand(new ClearFiltersCommand());
	}

	/**
	 * Check if any filters are active
	 */
	private hasActiveFilters(filter: IPluginFilter): boolean {
		return Object.entries(filter).some(([key, value]) => {
			if (key === 'sortBy' || key === 'sortDirection') return false;
			return (
				value !== undefined &&
				value !== null &&
				value !== '' &&
				(Array.isArray(value) ? value.length > 0 : true)
			);
		});
	}

	/**
	 * Count active filters
	 */
	private countActiveFilters(filter: IPluginFilter): number {
		let count = 0;

		if (filter.search) count++;
		if (filter.categories?.length) count++;
		if (filter.status?.length) count++;
		if (filter.types?.length) count++;
		if (filter.tags?.length) count++;
		if (filter.priceRange) count++;
		if (filter.author) count++;
		if (filter.license?.length) count++;
		if (filter.minDownloads) count++;
		if (filter.dateRange) count++;
		if (filter.featured) count++;
		if (filter.verified) count++;

		return count;
	}

	/**
	 * Get default filter state
	 */
	private getDefaultFilter(): IPluginFilter {
		return {
			sortBy: 'downloadCount',
			sortDirection: 'desc'
		};
	}
}

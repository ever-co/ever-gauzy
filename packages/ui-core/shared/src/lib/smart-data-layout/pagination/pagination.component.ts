import { Component, Output, EventEmitter, Input, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';
import { UntilDestroy } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/ui-core/common';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-pagination',
    templateUrl: './pagination.component.html',
    styleUrls: ['./pagination.component.scss'],
    standalone: false
})
export class PaginationComponent implements OnInit {
	/*
	 * Getter & Setter for dynamic totalItems
	 */
	_totalItems: number = 1;
	get totalItems(): number {
		return this._totalItems;
	}
	@Input() set totalItems(value: number) {
		this._totalItems = value;
	}

	/*
	 * Getter & Setter for dynamic activePage
	 */
	_activePage: number = 1;
	get activePage(): number {
		return this._activePage;
	}
	@Input() set activePage(value: number) {
		this.subject$.next(value);
		this._activePage = value;
	}

	/*
	 * Getter & Setter for dynamic itemsPerPage
	 */
	_itemsPerPage: number = 5;
	get itemsPerPage(): number {
		return this._itemsPerPage;
	}
	@Input() set itemsPerPage(value: number) {
		this.selectedOption.emit(value);
		this._itemsPerPage = value;
	}

	/*
	 * Getter & Setter for enable/disable emit EventEmitter
	 */
	_doEmit: boolean = true;
	get doEmit(): boolean {
		return this._doEmit;
	}
	@Input() set doEmit(value: boolean) {
		this._doEmit = value;
	}

	subject$: Subject<any> = new Subject();

	@Output() selectedPage = new EventEmitter<number>();
	@Output() selectedOption = new EventEmitter<number>();

	ngOnInit() {
		this.subject$
			.pipe(
				debounceTime(200),
				distinctUntilChange(), // do not emit pagination on multiple click on same element,
				tap(() => this.selectedPage.emit(this.activePage))
			)
			.subscribe();

		// Do not emit pagination on multiple click on same element
		if (this.doEmit) {
			this.subject$.next(this.activePage);
		}
	}

	/**
	 * Generates an array of page numbers to be displayed in the pagination.
	 * The number of displayed pages is adjustable based on the current active page.
	 *
	 * @returns An array of page numbers.
	 */
	getPages(): number[] {
		const totalPages = this.getPagesCount(); // Total number of pages
		const displayCount = 5; // Number of pages to display
		const effectiveDisplayCount = Math.min(totalPages, displayCount); // Ensure we don't exceed total pages
		const middlePage = Math.ceil(effectiveDisplayCount / 2); // Calculate middle page position

		// Determine the last page to display
		let lastPage =
			this.activePage >= middlePage
				? Math.min(this.activePage + Math.floor(effectiveDisplayCount / 2), totalPages)
				: effectiveDisplayCount;

		// Determine the first page to display
		const firstPage = Math.max(lastPage - effectiveDisplayCount + 1, 1); // Ensure first page is at least 1

		// Generate the array of page numbers
		return Array.from({ length: lastPage - firstPage + 1 }, (_, index) => firstPage + index);
	}

	/**
	 * Calculates the starting index of the items on the current page.
	 *
	 * @returns The starting index of the items for the active page.
	 */
	getStartPagesCount(): number {
		return (this.activePage - 1) * this.itemsPerPage + 1;
	}

	/**
	 * Calculates the ending index of the items on the current page.
	 *
	 * @returns The ending index of the items for the active page, capped at the total number of items.
	 */
	getEndPagesCount(): number {
		const entriesEndPage = (this.activePage - 1) * this.itemsPerPage + this.itemsPerPage;

		// Ensure the ending index does not exceed the total number of items
		return entriesEndPage > this.totalItems ? this.totalItems : entriesEndPage;
	}

	/**
	 * Calculates the total number of pages based on the total items and items per page.
	 *
	 * @returns The total number of pages available.
	 */
	getPagesCount(): number {
		return Math.ceil(this.totalItems / this.itemsPerPage);
	}

	/**
	 * Updates the active page index when the user changes the page.
	 *
	 * @param pageIdx - The index of the page to switch to.
	 */
	onChangePage(pageIdx: number): void {
		this.activePage = pageIdx;
	}

	/**
	 * Handles the action of clicking the next page button.
	 * Increments the active page by 1, unless it is already the last page.
	 */
	onNextPageClick(): void {
		// Increment activePage or set it to the last page if already at the end
		this.activePage = this.activePage >= this.getPagesCount() ? this.getPagesCount() : this.activePage + 1;
		// Emit the updated active page
		this.subject$.next(this.activePage);
	}

	/**
	 * Handles the action of clicking the previous page button.
	 * Decrements the active page by 1, unless it is already the first page.
	 */
	onPrevPageClick(): void {
		// Prevent decrementing if already on the first page
		if (this.activePage === 1) return;

		// Decrement activePage
		this.activePage--;
		// Emit the updated active page
		this.subject$.next(this.activePage);
	}
}

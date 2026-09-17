import { AfterViewInit, Component, OnInit, ElementRef, HostListener, Input, ViewChild, OnDestroy } from '@angular/core';
import { trigger, style, animate, transition } from '@angular/animations';
import { NbDialogRef } from '@nebular/theme';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { saveAs } from 'file-saver';
import { sortBy } from 'underscore';
import { IEmployee, TimeFormatEnum } from '@gauzy/contracts';
import { GalleryItem } from './gallery.directive';
import { GalleryService } from './gallery.service';
import { TimeZoneService } from '../timesheet/gauzy-filters/timezone-filter';
import { Observable } from 'rxjs';

export const fadeInOutAnimation = trigger('fadeInOut', [
	transition(':enter', [
		// :enter is alias to 'void => *'
		style({ opacity: 0 }),
		animate(300, style({ opacity: 1 }))
	]),
	transition(':leave', [
		// :leave is alias to '* => void'
		animate(300, style({ opacity: 0 }))
	])
]);

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ngx-gallery',
    templateUrl: './gallery.component.html',
    styleUrls: ['./gallery.component.scss'],
    animations: [fadeInOutAnimation],
    standalone: false
})
export class GalleryComponent implements OnInit, AfterViewInit, OnDestroy {
	public active_index: number;
	public items: GalleryItem[] = [];

	@Input() item: GalleryItem;
	@Input() employeeId: IEmployee['id'];

	@ViewChild('customScroll', { static: true }) customScroll: ElementRef<HTMLElement>;
	@ViewChild('galleryInner', { static: true }) galleryInner: ElementRef<HTMLElement>;

	public timeZone$: Observable<string> = this._timeZoneService.timeZone$.pipe(
		filter((timeZone: string) => !!timeZone)
	);
	public timeFormat$: Observable<TimeFormatEnum> = this._timeZoneService.timeFormat$.pipe(
		filter((timeFormat: TimeFormatEnum) => !!timeFormat)
	);

	constructor(
		private readonly _dialogRef: NbDialogRef<GalleryComponent>,
		private readonly _galleryService: GalleryService,
		private readonly _timeZoneService: TimeZoneService
	) {}

	/**
	 * Initializes the component and subscribes to changes in the items emitted by the gallery service.
	 * Filters the items based on the employeeId property, if provided.
	 * Sets the items property and focuses on the active item.
	 */
	ngOnInit() {
		// Subscribe to changes in the items emitted by the gallery service
		this._galleryService.items$
			.pipe(untilDestroyed(this)) // Unsubscribe when the component is destroyed
			.subscribe((items) => {
				// Filter the items based on the employeeId property, if provided
				if (this.employeeId) {
					items = items.filter((item: GalleryItem) => item.employeeId === this.employeeId);
				}
				// In time order: the store holds them in the order each card added them,
				// so previous/next used to jump back and forth in time. Items without a
				// `recordedAt` (product images) keep their order.
				this.items = sortBy(items, 'recordedAt');
				// Set the focus on the active item
				this.setFocus(this.item);
			});
	}

	/**
	 * Moves focus into the viewer itself rather than onto its first button, where
	 * the dialog's own auto-focus put it: an arrow-key press then drew a focus ring
	 * on that button. The screenshot opener turns the dialog's auto-focus off.
	 */
	ngAfterViewInit() {
		this.galleryInner.nativeElement.focus({ preventScroll: true });
	}

	/**
	 * Steps through the screenshots with the left and right arrow keys.
	 *
	 * @param $event The keyboard event.
	 */
	@HostListener('document:keydown', ['$event'])
	onKeydown($event: KeyboardEvent) {
		if ($event.key === 'ArrowLeft' && this.active_index > 0) {
			this.previous($event);
		} else if ($event.key === 'ArrowRight' && this.active_index < this.items.length - 1) {
			this.next($event);
		}
	}

	/**
	 * Closes the dialog.
	 * This function is typically called to close a dialog or modal window.
	 */
	close() {
		// Close the dialog
		this._dialogRef.close();
	}

	/**
	 * Handles navigation to the next item in the list.
	 * Stops event propagation to prevent parent event handlers from being triggered.
	 * Updates the active index to the next index and sets the active item accordingly.
	 * Ensures that the active item is visible within a scrollable container.
	 *
	 * @param $event The event object.
	 */
	next($event: Event) {
		// Stop event propagation to prevent parent event handlers from being triggered
		$event.stopPropagation();

		// Update the active index to the next index within the bounds of the item list
		this.active_index = Math.min(this.active_index + 1, this.items.length - 1);

		// Set the active item based on the updated active index
		this.item = this.items[this.active_index];

		// Ensure that the active item is visible within a scrollable container
		this.updateActiveIndex();
	}

	/**
	 * Handles navigation to the previous item in the list.
	 * Stops event propagation to prevent parent event handlers from being triggered.
	 * Updates the active index to the previous index and sets the active item accordingly.
	 * Ensures that the active item is visible within a scrollable container.
	 * @param $event The event object.
	 */
	previous($event: Event) {
		// Stop event propagation to prevent parent event handlers from being triggered
		$event.stopPropagation();

		// Update the active index to the previous index within the bounds of the item list
		this.active_index = Math.max(this.active_index - 1, 0);

		// Set the active item based on the updated active index
		this.item = this.items[this.active_index];

		// Ensure that the active item is visible within a scrollable container
		this.updateActiveIndex();
	}

	/**
	 * Sets the focus on a selected item in the gallery.
	 * If the selected item is found in the gallery, it becomes the active item.
	 * If not found, the provided item becomes the active item.
	 * Also updates the active index accordingly.
	 * @param selectedItem The item to set focus on.
	 */
	setFocus(selectedItem: GalleryItem) {
		// Find the item with the same fullUrl as the selectedItem
		const foundItem = this.items.find((item) => item.id === selectedItem.id);

		if (foundItem) {
			// If the found item exists, set it as the active item and update the active index
			this.item = foundItem;
			this.active_index = this.items.indexOf(foundItem);
		} else {
			// If the selected item is not found in the gallery, set the provided item as the active item
			this.item = selectedItem;
		}

		// Update the active index
		this.updateActiveIndex();
	}

	/**
	 * Scrolls the filmstrip so the active thumbnail is in view.
	 */
	updateActiveIndex() {
		// Deferred to the next frame: the `thumb-item-active` class only moves to the
		// new thumbnail once change detection has run, so looking it up right away
		// found the PREVIOUS one.
		requestAnimationFrame(() => {
			const activeItem = this.customScroll.nativeElement.querySelector('.thumb-item-active');

			// Centres the active thumbnail in the filmstrip.
			activeItem?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
		});
	}

	/**
	 * Downloads a file from the provided URL.
	 * @param url The URL of the file to download.
	 */
	downloadFile(url: string) {
		if (!url) {
			return;
		}

		this._galleryService.downloadFile(url).subscribe((blob) => {
			const fileName = url.substring(url.lastIndexOf('/') + 1);
			saveAs(blob, fileName);
		});
	}

	/**
	 * Returns the unique identifier of a thumbnail object for tracking purposes.
	 * @param index The index of the current item in the array.
	 * @param thumb The thumbnail object being iterated over.
	 * @returns The unique identifier of the thumbnail object.
	 */
	trackByThumbId(index: number, thumb: any): any {
		return thumb.id;
	}

	ngOnDestroy() {}
}

import { Injectable, Input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { uniq } from 'underscore';
import { GalleryItem } from './gallery.directive';

@Injectable({ providedIn: 'root' })
export class GalleryService {
	public dataStore: GalleryItem[] = [];

	@Input() items: GalleryItem[] = [];
	private _items: BehaviorSubject<GalleryItem[]> = new BehaviorSubject([]);

	public get items$() {
		return this._items.asObservable();
	}

	constructor(
		private readonly http: HttpClient
	) { }

	/**
	 * Append one or multiple gallery items to the data store and push them to the gallery.
	 *
	 * @param galleryItems The gallery item or array of gallery items to append.
	 */
	appendItems(galleryItems: GalleryItem | GalleryItem[]) {
		if (!galleryItems) return; // Exit early if galleryItems is falsy

		if (Array.isArray(galleryItems)) {
			this.dataStore = this.dataStore.concat(galleryItems);
		} else {
			this.dataStore.push(galleryItems);
		}

		this.pushToGallery();
	}

	/**
	 * Remove gallery images associated with deleted timeslot/timelog.
	 *
	 * @param galleryItems The gallery item or array of gallery items to remove.
	 */
	removeGalleryItems(galleryItems: GalleryItem | GalleryItem[]) {
		if (!galleryItems) return; // Exit early if galleryItems is falsy

		const items = Array.isArray(galleryItems) ? [...galleryItems] : [galleryItems];
		const idsToRemove = items.map(item => item.id);

		this.dataStore = this.dataStore.filter(item => !idsToRemove.includes(item.id));
		this.pushToGallery();
	}

	/**
	 * Updates the data store with unique GalleryItem objects based on their fullUrl,
	 * and emits the updated data store using a BehaviorSubject.
	 */
	pushToGallery() {
		this.dataStore = uniq(this.dataStore, (item: GalleryItem) => item.id);
		this._items.next(this.dataStore);
	}

	/*
	 * Clear all screenshots after destroy component
	 */
	clearGallery() {
		this.dataStore = [];
		this._items.next(this.dataStore);
	}

	/*
	 * Convert blob data from file url
	 */
	downloadFile(url: string): Observable<Blob> {
		return this.http.get(url, { responseType: 'blob' });
	}
}

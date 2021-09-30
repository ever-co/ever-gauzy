import { Injectable, OnInit, OnDestroy, Input } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router, NavigationStart } from '@angular/router';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as _ from 'underscore';
import { GalleryItem } from './gallery.directive';
import { HttpClient } from '@angular/common/http';

@UntilDestroy({ checkProperties: true })
@Injectable({
	providedIn: 'root'
})
export class GalleryService implements OnInit, OnDestroy {
	public dataStore: GalleryItem[] = [];

	@Input()
	items: GalleryItem[] = [];

	_items: BehaviorSubject<GalleryItem[]> = new BehaviorSubject([]);

	get items$() {
		return this._items.asObservable();
	}

	constructor(
		private router: Router, 
		private http: HttpClient
	) {}

	ngOnInit(): void {
		this.router.events
			.pipe(
				filter((event) => {
					return event instanceof NavigationStart;
				}),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.dataStore = [];
			});
	}

	appendItems(galleryItems: GalleryItem | GalleryItem[]) {
		if (galleryItems) {
			if (galleryItems instanceof Array) {
				this.dataStore = this.dataStore.concat(galleryItems);
			} else {
				this.dataStore.push(galleryItems);
			}
			this.pushToGallery();
		}
	}

	/*
	 * Remove gallery images after delete timeslot/timelog
	 */
	removeGalleryItems(galleryItems: GalleryItem | GalleryItem[]) {
		let items: GalleryItem[] = [];
		if (galleryItems) {
			if (galleryItems instanceof Array) {
				items = items.concat(galleryItems);
			} else {
				items.push(galleryItems);
			}

			const ids = items.map((e: any) => e.id);
			const screenshots = this.dataStore.filter(
				(e: any) => !ids.includes(e.id)
			);

			this.dataStore = screenshots;
			this.pushToGallery();
		}
	}

	pushToGallery() {
		this.dataStore = _.uniq(
			this.dataStore,
			(galleryItem) => galleryItem.fullUrl
		);
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
		return this.http.get(url, {
		  responseType: 'blob'
		});
	}

	ngOnDestroy(): void {}
}

import { Injectable, OnInit, OnDestroy, Input } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router, NavigationStart } from '@angular/router';
import { filter } from 'rxjs/operators';
import { untilDestroyed } from 'ngx-take-until-destroy';
import * as _ from 'underscore';

export interface GalleryItem {
	thumbUrl: string;
	fullUrl: string;
}

@Injectable({
	providedIn: 'root'
})
export class GalleryService implements OnInit, OnDestroy {
	dataStore: GalleryItem[] = [];

	@Input()
	items: GalleryItem[] = [];

	_items: BehaviorSubject<GalleryItem[]> = new BehaviorSubject([]);

	get items$() {
		return this._items.asObservable();
	}

	constructor(private router: Router) {}

	ngOnInit(): void {
		this.router.events
			.pipe(
				filter((event) => {
					return event instanceof NavigationStart;
				}),
				untilDestroyed(this)
			)
			.subscribe(() => {
				//if (!this.items) {
				this.dataStore = [];
				//}
			});
	}

	appendItems(galleryItems: GalleryItem | GalleryItem[]) {
		if (galleryItems) {
			if (galleryItems instanceof Array) {
				this.dataStore = this.dataStore.concat(galleryItems);
			} else {
				this.dataStore.push(galleryItems);
			}
			this.dataStore = _.uniq(
				this.dataStore,
				(galleryItem) => galleryItem.fullUrl
			);
			this._items.next(this.dataStore);
		}
	}

	ngOnDestroy(): void {}
}

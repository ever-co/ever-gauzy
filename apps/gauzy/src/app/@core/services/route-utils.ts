import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Injectable, OnDestroy } from '@angular/core';
import { untilDestroyed } from 'ngx-take-until-destroy';

@Injectable()
export class RouteUtil implements OnDestroy {
	dataStore: {
		data: any;
	};
	private _data: BehaviorSubject<any>;

	constructor(
		private router: Router,
		private activatedRoute: ActivatedRoute
	) {
		this.dataStore = { data: {} };
		this._data = new BehaviorSubject(this.dataStore.data);
		this.router.events
			.pipe(
				filter((event) => event instanceof NavigationEnd),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.updateData();
			});
		this.updateData();
	}

	public get data(): any {
		return this.dataStore.data;
	}

	public get data$(): Observable<any> {
		return this._data.asObservable();
	}

	public set data(value: any) {
		this.dataStore.data = value;
		this._data.next(Object.assign({}, this.dataStore).data);
	}

	updateData() {
		let data: any = {};
		let route = this.activatedRoute.snapshot;
		do {
			data = Object.assign(data, route.data);
			route = route.firstChild;
		} while (route);
		this.data = data;
	}
	ngOnDestroy(): void {}
}

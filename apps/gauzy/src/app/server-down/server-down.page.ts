import { Component, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '../@core/services/store.service';

@Component({
	styleUrls: ['./server-down.page.scss'],
	templateUrl: 'server-down.page.html'
})
export class ServerDownPage implements OnDestroy {
	noInternetLogo: string;
	interval;

	constructor(
		private store: Store,
		private readonly http: HttpClient,
		private location: Location,
		private translate: TranslateService
	) {}

	ngOnDestroy(): void {}
}

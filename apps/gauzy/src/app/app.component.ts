/**
 * @license
 * Copyright Akveo. All Rights Reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */
import { Component, OnInit } from '@angular/core';
import { AnalyticsService } from './@core/utils/analytics.service';
import { Cloudinary } from '@cloudinary/angular-5.x';
import { HttpClient } from '@angular/common/http';
import { first } from 'rxjs/operators';
import { Store } from './@core/services/store.service';
import { Router } from '@angular/router';

@Component({
	selector: 'ga-app',
	template: '<router-outlet></router-outlet>'
})
export class AppComponent implements OnInit {
	constructor(
		private analytics: AnalyticsService,
		private _cloudinary: Cloudinary,
		private readonly httpClient: HttpClient,
		private store: Store,
		private router: Router
	) {}

	async ngOnInit() {
		this.analytics.trackPageViews();
	}
}

/**
 * @license
 * Copyright Akveo. All Rights Reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */
import { Component, OnInit } from '@angular/core';
import { AnalyticsService } from './@core/utils/analytics.service';
import { Cloudinary } from '@cloudinary/angular-5.x';

@Component({
	selector: 'ga-app',
	template: '<router-outlet></router-outlet>'
})
export class AppComponent implements OnInit {
	constructor(
		private analytics: AnalyticsService,
		private _cloudinary: Cloudinary
	) {}

	ngOnInit(): void {
		this.analytics.trackPageViews();
	}
}

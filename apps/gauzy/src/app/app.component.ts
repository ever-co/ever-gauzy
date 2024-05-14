/**
 * @license
 * Copyright Akveo. All Rights Reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */
import { AfterViewInit, Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { LangChangeEvent, TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, map, mergeMap, take, tap } from 'rxjs';
import { pluck, union } from 'underscore';
import { IDateRangePicker, ILanguage, LanguagesEnum } from '@gauzy/contracts';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { AnalyticsService, JitsuService, SeoService } from './@core/services';
import {
	DateRangePickerBuilderService,
	DEFAULT_DATE_PICKER_CONFIG,
	DEFAULT_SELECTOR_VISIBILITY,
	LanguagesService,
	SelectorBuilderService,
	Store
} from './@core/services';
import { environment } from '../environments/environment';
import { IDatePickerConfig, ISelectorVisibility } from './@core/services/selector-builder/selector-builder-types';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-app',
	template: '<router-outlet *ngIf="!loading"></router-outlet>'
})
export class AppComponent implements OnInit, AfterViewInit {
	//
	public loading: boolean = true;

	constructor(
		private readonly jitsuService: JitsuService,
		private readonly analytics: AnalyticsService,
		private readonly seoService: SeoService,
		private readonly store: Store,
		private readonly languagesService: LanguagesService,
		public readonly translate: TranslateService,
		private readonly router: Router,
		private readonly activatedRoute: ActivatedRoute,
		public readonly selectorBuilderService: SelectorBuilderService,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		this.getActivateRouterDataEvent();
	}

	/**
	 *
	 */
	ngOnInit() {
		if (environment.CHATWOOT_SDK_TOKEN) {
			this.loadChatwoot(document, 'script');
		}

		/**
		 * Track page views using analytics service.
		 */
		this.analytics.trackPageViews();

		/**
		 * Track page views using Jitsu service.
		 */
		this.jitsuService.trackPageViews();

		/**
		 * Track changes in canonical URLs for SEO purposes.
		 */
		this.seoService.trackCanonicalChanges();

		/**
		 * Observable that emits when system languages change.
		 */
		const systemLanguages$ = this.store.systemLanguages$.pipe(distinctUntilChange(), untilDestroyed(this), take(1));
		// Subscribe to changes in system languages
		systemLanguages$.subscribe((languages: ILanguage[]) => {
			// Returns the language code name from the browser, e.g., "en", "bg", "he", "ru"
			const browserLang = this.translate.getBrowserLang();

			// Gets default enum languages, e.g., "en", "bg", "he", "ru"
			const defaultLanguages: string[] = Object.values(LanguagesEnum);

			// Gets system languages
			let systemLanguages: string[] = pluck(languages, 'code');
			systemLanguages = union(systemLanguages, defaultLanguages);

			// Sets the default language to use as a fallback, e.g., "en"
			this.translate.setDefaultLang(LanguagesEnum.ENGLISH);

			// Get preferredLanguage if it exists
			const preferredLanguage = this.store?.user?.preferredLanguage ?? this.store.preferredLanguage ?? null;

			// Use browser language as the primary language, if not found then use the system default language (e.g., "en")
			const selectedLanguage =
				preferredLanguage ?? (systemLanguages.includes(browserLang) ? browserLang : LanguagesEnum.ENGLISH);

			// Set the selected language
			this.translate.use(selectedLanguage);

			/**
			 * It also sets the loading flag to false after language change.
			 */
			this.translate.onLangChange.subscribe((langChangeEvent: LangChangeEvent) => {
				// Set the loading flag to false after the language change
				this.loading = false;
			});
		});

		if (Number(this.store.serverConnection) === 0) {
			this.loading = false;
		}
	}

	/**
	 * Executes the `loadLanguages` method after the view has been initialized.
	 */
	async ngAfterViewInit() {
		await this.loadLanguages();
	}

	/**
	 * Asynchronously loads system languages from the service and filters them.
	 */
	private async loadLanguages() {
		// Fetch system languages from the service
		const { items = [] } = await this.languagesService.getSystemLanguages();

		// Filter languages to include only system languages
		const systemLanguages = items.filter((item: ILanguage) => item.is_system);

		// Store the filtered system languages in the store
		this.store.systemLanguages = systemLanguages || [];
	}

	/**
	 * Dynamically loads the Chatwoot SDK.
	 *
	 * @param document - The document object.
	 * @param tagName - The HTML tag name.
	 */
	private loadChatwoot(document: Document, tagName: string) {
		const chatwootBaseUrl = 'https://app.chatwoot.com';

		// Create a script element
		const scriptElement = document.createElement(tagName) as HTMLScriptElement;

		// Set the source URL for the Chatwoot SDK script
		scriptElement.src = `${chatwootBaseUrl}/packs/js/sdk.js`;

		// Insert the script element before the first script element in the document
		document.head.insertBefore(scriptElement, document.head.firstChild);

		// Set the function to be executed once the script is loaded
		scriptElement.onload = () => {
			// Run the Chatwoot SDK with the specified website token and base URL
			window['chatwootSDK'].run({
				websiteToken: environment.CHATWOOT_SDK_TOKEN,
				baseUrl: chatwootBaseUrl
			});
		};
	}

	/**
	 * Subscribe to router events related to activating routes.
	 * Handles updating Date Range Picker, Date Picker Config, and Selector visibility based on route data.
	 */
	getActivateRouterDataEvent() {
		this.router.events
			.pipe(
				// Filter for NavigationEnd events
				filter((event) => event instanceof NavigationEnd),
				// Map to the activated route
				map(() => this.activatedRoute),
				// Traverse to the primary outlet route
				map((route) => {
					while (route.firstChild) route = route.firstChild;
					return route;
				}),
				// Filter for routes in the primary outlet
				filter((route) => route.outlet === 'primary'),
				// MergeMap to the route data
				mergeMap((route) => route.data),
				/**
				 * Set Date Range Picker Default Unit and Config
				 */
				tap(
					({
						datePicker,
						dates
					}: {
						datePicker: IDatePickerConfig;
						dates: IDateRangePicker;
						selectors: ISelectorVisibility;
					}) => {
						if (isNotEmpty(dates)) {
							this.dateRangePickerBuilderService.setDateRangePicker(dates);
						}
						// Set Date Range Picker Default Unit
						const datePickerConfig = Object.assign({}, DEFAULT_DATE_PICKER_CONFIG, datePicker);
						this.dateRangePickerBuilderService.setDatePickerConfig(datePickerConfig);
					}
				),
				// Set selectors' visibility
				tap(({ selectors }: { selectors?: ISelectorVisibility }) => {
					// Iterate through the visibility settings for selectors
					Object.entries(Object.assign({}, DEFAULT_SELECTOR_VISIBILITY, selectors)).forEach(([id, value]) => {
						// Set the visibility for each selector based on the provided or default value
						this.selectorBuilderService.setSelectorsVisibility(
							id,
							typeof selectors === 'boolean' ? selectors : value
						);
					});
					// Retrieve and get the updated selectors' visibility
					this.selectorBuilderService.getSelectorsVisibility();
				}),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}
}

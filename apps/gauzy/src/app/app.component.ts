/**
 * @license
 * Copyright Akveo. All Rights Reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 */
import { AfterViewInit, Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { filter, map, mergeMap, take, tap } from 'rxjs';
import { pluck, union } from 'underscore';
import {
	AnalyticsService,
	DEFAULT_DATE_PICKER_CONFIG,
	DEFAULT_SELECTOR_VISIBILITY,
	DateRangePickerBuilderService,
	IDatePickerConfig,
	ISelectorVisibility,
	JitsuService,
	LanguagesService,
	SelectorBuilderService,
	SeoService
} from '@gauzy/ui-core/core';
import { IDateRangePicker, ILanguage, LanguagesEnum } from '@gauzy/contracts';
import { distinctUntilChange, isNotEmpty, Store } from '@gauzy/ui-core/common';
import { I18nService } from '@gauzy/ui-core/i18n';
import { environment } from '@gauzy/ui-config';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-app',
	template: '<router-outlet *ngIf="!loading"></router-outlet>'
})
export class AppComponent implements OnInit, AfterViewInit {
	// Loading indicator
	public loading: boolean = true;

	constructor(
		private readonly _jitsuService: JitsuService,
		private readonly _analytics: AnalyticsService,
		private readonly _seoService: SeoService,
		private readonly _store: Store,
		private readonly _languagesService: LanguagesService,
		private readonly _translateService: TranslateService,
		private readonly _i18nService: I18nService,
		private readonly _router: Router,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _selectorBuilderService: SelectorBuilderService,
		private readonly _dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		this.getActivateRouterDataEvent();
		this.getPreferredLanguage();
	}

	/**
	 *
	 */
	ngOnInit() {
		if (environment.CHATWOOT_SDK_TOKEN) {
			this.loadChatwoot(document, 'script');
		}

		// Track page views using analytics service.
		this._analytics.trackPageViews();

		// Track page views using Jitsu service.
		this._jitsuService.trackPageViews();

		// Track changes in canonical URLs for SEO purposes.
		this._seoService.trackCanonicalChanges();

		// Observable that emits when system languages change.
		const systemLanguages$ = this._store.systemLanguages$.pipe(
			distinctUntilChange(),
			untilDestroyed(this),
			take(1)
		);
		// Subscribe to changes in system languages
		systemLanguages$.subscribe((languages: ILanguage[]) => {
			// Returns the language code name from the browser, e.g., "en", "bg", "he", "ru"
			const browserLang = this._i18nService.getBrowserLang();

			// Gets default available enum languages, e.g., "en", "bg", "he", "ru"
			const availableLanguages: string[] = this._i18nService.availableLanguages;

			// Gets system languages
			let systemLanguages: string[] = pluck(languages, 'code');
			systemLanguages = union(systemLanguages, availableLanguages);

			// Sets the default language to use as a fallback, e.g., "en"
			this._i18nService.setDefaultLang(LanguagesEnum.ENGLISH);

			// Get preferredLanguage if it exists
			const preferredLanguage = this._store?.user?.preferredLanguage ?? this._store.preferredLanguage ?? null;

			// Use browser language as the primary language, if not found then use the system default language (e.g., "en")
			const systemLanguage = systemLanguages.includes(browserLang) ? browserLang : LanguagesEnum.ENGLISH;

			// Set the selected language
			this._translateService.use(preferredLanguage || systemLanguage);

			// Observable that emits when theme languages change.
			this._translateService.onLangChange.subscribe(() => {
				// Set the loading flag to false after the language change
				this.loading = false;
			});
		});

		if (Number(this._store.serverConnection) === 0) {
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
		const { items = [] } = await this._languagesService.getSystemLanguages();

		// Filter languages to include only system languages
		const systemLanguages = items.filter((item: ILanguage) => item.is_system);

		// Store the filtered system languages in the store
		this._store.systemLanguages = systemLanguages || [];
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
		this._router.events
			.pipe(
				// Filter for NavigationEnd events
				filter((event) => event instanceof NavigationEnd),
				// Map to the activated route
				map(() => this._activatedRoute),
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
				// Set selectors' visibility
				tap(({ selectors }: { selectors?: ISelectorVisibility }) => {
					// Iterate through the visibility settings for selectors
					Object.entries(Object.assign({}, DEFAULT_SELECTOR_VISIBILITY, selectors)).forEach(([id, value]) => {
						// Set the visibility for each selector based on the provided or default value
						this._selectorBuilderService.setSelectorsVisibility(
							id,
							typeof selectors === 'boolean' ? selectors : value
						);
					});
					// Retrieve and get the updated selectors' visibility
					this._selectorBuilderService.getSelectorsVisibility();
				}),
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
							this._dateRangePickerBuilderService.setDateRangePicker(dates);
						}
						// Set Date Range Picker Default Unit
						const datePickerConfig = Object.assign({}, DEFAULT_DATE_PICKER_CONFIG, datePicker);
						this._dateRangePickerBuilderService.setDatePickerConfig(datePickerConfig);
					}
				),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Subscribe to the preferred language observable and set the language
	 */
	getPreferredLanguage(): void {
		this._i18nService.preferredLanguage$
			.pipe(
				tap((lang: string) => this._translateService.use(lang)),
				untilDestroyed(this)
			)
			.subscribe();
	}
}

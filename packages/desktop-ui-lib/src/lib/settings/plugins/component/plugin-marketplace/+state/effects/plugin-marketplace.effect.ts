import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { TranslateService } from '@ngx-translate/core';
import { EMPTY, catchError, debounceTime, distinctUntilChanged, filter, finalize, map, switchMap, tap } from 'rxjs';
import { ToastrNotificationService } from '../../../../../../services';
import { coalesceValue } from '../../../../../../utils';
import { PluginAnalyticsService } from '../../../../services/plugin-analytics.service';
import { PluginSecurityService } from '../../../../services/plugin-security.service';
import { PluginSettingsService } from '../../../../services/plugin-settings.service';
import {
	PluginBillingPeriod,
	PluginSubscriptionService,
	PluginSubscriptionType
} from '../../../../services/plugin-subscription.service';
import { PluginTagsService } from '../../../../services/plugin-tags.service';
import { PluginService } from '../../../../services/plugin.service';
import { PluginMarketplaceActions } from '../actions/plugin-marketplace.action';
import { PluginMarketplaceStore } from '../stores/plugin-market.store';

@Injectable({ providedIn: 'root' })
export class PluginMarketplaceEffects {
	constructor(
		private readonly action$: Actions,
		private readonly pluginMarketplaceStore: PluginMarketplaceStore,
		private readonly pluginService: PluginService,
		private readonly pluginTagsService: PluginTagsService,
		private readonly pluginSubscriptionService: PluginSubscriptionService,
		private readonly pluginSettingsService: PluginSettingsService,
		private readonly pluginAnalyticsService: PluginAnalyticsService,
		private readonly pluginSecurityService: PluginSecurityService,
		private readonly toastrService: ToastrNotificationService,
		private readonly translateService: TranslateService,
		private readonly router: Router
	) {}

	upload$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.upload),
			tap(() => {
				this.pluginMarketplaceStore.setUpload({ uploading: true });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.UPLOADING'));
			}),
			switchMap(({ plugin }) =>
				this.pluginService.upload(plugin).pipe(
					tap((res) => this.pluginMarketplaceStore.setUpload({ progress: coalesceValue(res?.progress, 0) })),
					filter((res) => Boolean(res?.plugin)), // Ensure plugin is not null/undefined
					map((res) => res.plugin),
					tap((uploaded) => {
						this.pluginMarketplaceStore.update((state) => ({
							plugins: [uploaded, ...state.plugins], // Immutable update
							count: state.count + 1
						}));
						this.toastrService.success(this.translateService.instant('PLUGIN.TOASTR.SUCCESS.UPLOADED'));
					}),
					finalize(() => this.pluginMarketplaceStore.setUpload({ uploading: false })), // Always stop loading
					catchError((error) => {
						this.toastrService.error(
							error.message || this.translateService.instant('PLUGIN.TOASTR.ERROR.UPLOAD')
						);
						return EMPTY; // Ensure the stream continues
					})
				)
			)
		)
	);

	getAll$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.getAll),
			tap(() => this.pluginMarketplaceStore.setLoading(true)), // Start loading state
			switchMap(({ params = {} }) =>
				this.pluginService.getAll(params).pipe(
					tap((response) => {
						console.log('API Response:', response); // Debug log
						const items = Array.isArray(response?.items)
							? response.items
							: Array.isArray(response)
							? response
							: [];
						const total = typeof response?.total === 'number' ? response.total : items.length;
						const skip = (params as any)?.skip || 0;

						this.pluginMarketplaceStore.update((state) => ({
							...state,
							plugins:
								skip > 1
									? [...new Map([...state.plugins, ...items].map((item) => [item.id, item])).values()]
									: items, // Replace on first load, merge on pagination
							count: total,
							totalCount: total,
							filteredCount: total
						}));
					}),
					finalize(() => this.pluginMarketplaceStore.setLoading(false)), // Always stop loading
					catchError((error) => {
						console.error('Plugin fetch error:', error); // Debug log
						this.toastrService.error(error.message || error); // Handle error properly
						return EMPTY; // Return a fallback observable
					})
				)
			)
		)
	);

	getOne$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.getOne),
			tap(() => this.pluginMarketplaceStore.setLoading(true)), // Start loading state
			switchMap(({ id, params = {} }) =>
				this.pluginService.getOne(id, params).pipe(
					filter(Boolean), // Filter out null or undefined responses
					tap((plugin) => {
						this.pluginMarketplaceStore.update({ plugin });
					}),
					finalize(() => this.pluginMarketplaceStore.setLoading(false)), // Always stop loading
					catchError((error) => {
						this.toastrService.error(error.message || error); // Handle error properly
						return EMPTY; // Return a fallback value to keep the stream alive
					})
				)
			)
		)
	);

	update$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.update),
			tap(() => {
				this.pluginMarketplaceStore.update({ updating: true });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.UPDATING'));
			}),
			switchMap(({ id, plugin }) =>
				this.pluginService.update(id, plugin).pipe(
					tap((plugin) => {
						this.pluginMarketplaceStore.update((state) => ({
							plugins: [...new Map([...state.plugins, plugin].map((item) => [item.id, item])).values()],
							plugin: { ...state.plugin, ...plugin }
						}));
						this.toastrService.success(this.translateService.instant('PLUGIN.TOASTR.SUCCESS.UPDATED'));
					}),
					finalize(() => this.pluginMarketplaceStore.update({ updating: false })),
					catchError((error) => {
						this.toastrService.error(error.message || error);
						return EMPTY;
					})
				)
			)
		)
	);

	delete$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.delete),
			tap(() => {
				this.pluginMarketplaceStore.update({ deleting: true });
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.DELETING'));
			}),
			switchMap(({ id }) =>
				this.pluginService.delete(id).pipe(
					tap(() => {
						this.router.navigate(['settings', 'marketplace-plugins']);
						this.pluginMarketplaceStore.update((state) => ({
							plugins: [...state.plugins.filter((plugin) => plugin.id !== id)],
							plugin: null
						}));
						this.toastrService.success(this.translateService.instant('PLUGIN.TOASTR.SUCCESS.DELETED'));
					}),
					finalize(() => this.pluginMarketplaceStore.update({ deleting: false })),
					catchError((error) => {
						this.toastrService.error(error.message || error);
						return EMPTY;
					})
				)
			)
		)
	);

	reset$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.reset),
			tap(() => this.pluginMarketplaceStore.update({ plugins: [] }))
		)
	);

	// Filter Effects
	setFilters$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.setFilters),
			tap(({ filters }) => {
				this.pluginMarketplaceStore.setFilters(filters);
			})
		)
	);

	applyFilters$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.applyFilters),
			debounceTime(300),
			tap(() => {
				this.pluginMarketplaceStore.applyFilters();
			})
		)
	);

	clearFilters$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.clearFilters),
			tap(() => {
				this.pluginMarketplaceStore.clearFilters();
			})
		)
	);

	toggleAdvancedFilters$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginMarketplaceActions.toggleAdvancedFilters),
				tap(({ show }) => {
					this.pluginMarketplaceStore.updateUI({ showAdvancedFilters: show });
				})
			),
		{ dispatch: false }
	);

	setViewMode$ = createEffect(
		() =>
			this.action$.pipe(
				ofType(PluginMarketplaceActions.setViewMode),
				tap(({ view }) => {
					this.pluginMarketplaceStore.updateUI({ selectedView: view });
				})
			),
		{ dispatch: false }
	);

	// Search Effects
	search$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.search),
			debounceTime(300),
			distinctUntilChanged((prev, curr) => prev.query === curr.query),
			tap(() => this.pluginMarketplaceStore.setLoading(true)),
			switchMap(({ query }) =>
				this.pluginService.search({ search: query }).pipe(
					tap((response) => {
						console.log('Search API Response:', response); // Debug log
						const items = Array.isArray(response?.items)
							? response.items
							: Array.isArray(response)
							? response
							: [];
						const total = typeof response?.total === 'number' ? response.total : items.length;

						this.pluginMarketplaceStore.update((state) => ({
							...state,
							plugins: items,
							count: total,
							totalCount: total,
							filteredCount: total,
							searchQuery: query
						}));
					}),
					finalize(() => this.pluginMarketplaceStore.setLoading(false)),
					catchError((error) => {
						console.error('Search error:', error); // Debug log
						this.toastrService.error(error.message || error);
						return EMPTY;
					})
				)
			)
		)
	);

	// Installation Effects
	install$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.install),
			tap(({ pluginId }) => {
				this.pluginMarketplaceStore.setInstalling(pluginId, true);
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.INSTALLING'));
			}),
			switchMap(({ pluginId, versionId }) =>
				this.pluginService.install({ pluginId, versionId }).pipe(
					tap(() => {
						this.pluginMarketplaceStore.update((state) => ({
							plugins: state.plugins.map((p) => (p.id === pluginId ? { ...p, isInstalled: true } : p))
						}));
						this.toastrService.success(this.translateService.instant('PLUGIN.TOASTR.SUCCESS.INSTALLED'));
					}),
					finalize(() => this.pluginMarketplaceStore.setInstalling(pluginId, false)),
					catchError((error) => {
						this.toastrService.error(
							error.message || this.translateService.instant('PLUGIN.TOASTR.ERROR.INSTALL')
						);
						return EMPTY;
					})
				)
			)
		)
	);

	uninstall$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.uninstall),
			tap(({ pluginId }) => {
				this.pluginMarketplaceStore.setInstalling(pluginId, true);
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.UNINSTALLING'));
			}),
			switchMap(({ pluginId, installationId, reason }) =>
				this.pluginService.uninstall(pluginId, installationId, reason).pipe(
					tap(() => {
						this.pluginMarketplaceStore.update((state) => ({
							plugins: state.plugins.map((p) => (p.id === pluginId ? { ...p, isInstalled: false } : p))
						}));
						this.toastrService.success(this.translateService.instant('PLUGIN.TOASTR.SUCCESS.UNINSTALLED'));
					}),
					finalize(() => this.pluginMarketplaceStore.setInstalling(pluginId, false)),
					catchError((error) => {
						this.toastrService.error(
							error.message || this.translateService.instant('PLUGIN.TOASTR.ERROR.UNINSTALL')
						);
						return EMPTY;
					})
				)
			)
		)
	);

	// Subscription Effects
	loadSubscriptionPlans$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.loadSubscriptionPlans),
			switchMap(({ pluginId }) =>
				this.pluginSubscriptionService.getPluginPlans(pluginId).pipe(
					tap((plans) => {
						this.pluginMarketplaceStore.setSubscriptionPlans(pluginId, plans);
					}),
					catchError((error) => {
						this.toastrService.error(error.message || 'Failed to load subscription plans');
						return EMPTY;
					})
				)
			)
		)
	);

	subscribe$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.subscribe),
			tap(() => {
				this.toastrService.info(this.translateService.instant('PLUGIN.TOASTR.INFO.SUBSCRIBING'));
			}),
			switchMap(({ pluginId, planId, paymentMethod }) =>
				this.pluginSubscriptionService
					.createSubscription({
						pluginId,
						planId,
						subscriptionType: PluginSubscriptionType.BASIC,
						billingPeriod: PluginBillingPeriod.MONTHLY,
						paymentMethodId: paymentMethod.id
					})
					.pipe(
						tap((subscription) => {
							this.pluginMarketplaceStore.setSubscription(pluginId, subscription);
							this.toastrService.success(
								this.translateService.instant('PLUGIN.TOASTR.SUCCESS.SUBSCRIBED')
							);
						}),
						catchError((error) => {
							this.toastrService.error(error.message || 'Failed to create subscription');
							return EMPTY;
						})
					)
			)
		)
	);

	// Tags Effects
	loadTags$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.loadTags),
			switchMap(() =>
				this.pluginTagsService.getAllTags().pipe(
					tap(({ items: tags }) => {
						this.pluginMarketplaceStore.setTags(tags);
					}),
					catchError((error) => {
						this.toastrService.error(error.message || 'Failed to load tags');
						return EMPTY;
					})
				)
			)
		)
	);

	createTag$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.createTag),
			switchMap(({ tag }) =>
				this.pluginTagsService.createTag(tag).pipe(
					tap((newTag) => {
						this.pluginMarketplaceStore.addTag(newTag);
						this.toastrService.success('Tag created successfully');
					}),
					catchError((error) => {
						this.toastrService.error(error.message || 'Failed to create tag');
						return EMPTY;
					})
				)
			)
		)
	);

	// Settings Effects
	loadPluginSettings$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.loadPluginSettings),
			switchMap(({ pluginId }) =>
				this.pluginSettingsService.getPluginSettings(pluginId).pipe(
					tap((settings) => {
						this.pluginMarketplaceStore.setPluginSettings(pluginId, settings);
					}),
					catchError((error) => {
						this.toastrService.error(error.message || 'Failed to load plugin settings');
						return EMPTY;
					})
				)
			)
		)
	);

	updatePluginSetting$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.updatePluginSetting),
			switchMap(({ pluginId, key, value }) =>
				this.pluginSettingsService.setSettingValue(pluginId, key, value).pipe(
					tap((setting) => {
						this.pluginMarketplaceStore.updatePluginSetting(pluginId, setting);
						this.toastrService.success('Setting updated successfully');
					}),
					catchError((error) => {
						this.toastrService.error(error.message || 'Failed to update setting');
						return EMPTY;
					})
				)
			)
		)
	);

	// Analytics Effects
	loadPluginAnalytics$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.loadPluginAnalytics),
			switchMap(({ pluginId, period }) =>
				this.pluginAnalyticsService.getPluginMetrics(pluginId, period).pipe(
					tap((analytics) => {
						this.pluginMarketplaceStore.setPluginAnalytics(pluginId, analytics);
					}),
					catchError((error) => {
						this.toastrService.error(error.message || 'Failed to load plugin analytics');
						return EMPTY;
					})
				)
			)
		)
	);

	// Security Effects
	loadPluginSecurity$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.loadPluginSecurity),
			switchMap(({ pluginId }) =>
				this.pluginSecurityService.getPluginSecurity(pluginId).pipe(
					tap((security) => {
						this.pluginMarketplaceStore.setPluginSecurity(pluginId, security);
					}),
					catchError((error) => {
						this.toastrService.error(error.message || 'Failed to load plugin security');
						return EMPTY;
					})
				)
			)
		)
	);

	// Rating Effects
	ratePlugin$ = createEffect(() =>
		this.action$.pipe(
			ofType(PluginMarketplaceActions.ratePlugin),
			switchMap(({ pluginId, rating, review }) =>
				this.pluginService.ratePlugin(pluginId, rating, review).pipe(
					tap((ratingData) => {
						this.pluginMarketplaceStore.updatePluginRating(pluginId, ratingData);
						this.toastrService.success('Rating submitted successfully');
					}),
					catchError((error) => {
						this.toastrService.error(error.message || 'Failed to submit rating');
						return EMPTY;
					})
				)
			)
		)
	);
}

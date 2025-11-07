import { Injectable } from '@angular/core';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { PluginSettingsService } from '../../../../services/plugin-settings.service';
import { PluginSettingsActions } from '../actions/plugin-settings.actions';
import { PluginSettingsStore } from '../stores/plugin-settings.store';

@Injectable({ providedIn: 'root' })
export class PluginSettingsEffects {
	constructor(
		private readonly actions$: Actions,
		private readonly pluginSettingsService: PluginSettingsService,
		private readonly store: PluginSettingsStore
	) {}

	loadSettings$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.loadSettings),
				tap(() => this.store.setLoading(true)),
				switchMap(({ pluginId, query }) =>
					this.pluginSettingsService.getPluginSettings(pluginId, query).pipe(
						map((settings) => {
							this.store.setLoading(false);
							return PluginSettingsActions.loadSettingsSuccess({ settings });
						}),
						catchError((error) => {
							this.store.setLoading(false);
							return of(
								PluginSettingsActions.loadSettingsFailure({ error: error.message || 'Unknown error' })
							);
						})
					)
				)
			);
		},
		{ dispatch: true }
	);

	loadGroupedSettings$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.loadGroupedSettings),
				tap(() => this.store.setLoading(true)),
				switchMap(({ pluginId, query }) =>
					this.pluginSettingsService.getPluginSettingsGrouped(pluginId, query).pipe(
						map((settingsGroups) => {
							this.store.setLoading(false);
							return PluginSettingsActions.loadGroupedSettingsSuccess({ settingsGroups });
						}),
						catchError((error) => {
							this.store.setLoading(false);
							return of(
								PluginSettingsActions.loadGroupedSettingsFailure({
									error: error.message || 'Unknown error'
								})
							);
						})
					)
				)
			);
		},
		{ dispatch: true }
	);

	createSetting$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.createSetting),
				tap(() => this.store.setSaving(true)),
				switchMap(({ pluginId, setting }) =>
					this.pluginSettingsService.createPluginSetting(pluginId, setting).pipe(
						map((newSetting) => {
							this.store.setSaving(false);
							return PluginSettingsActions.createSettingSuccess({ setting: newSetting });
						}),
						catchError((error) => {
							this.store.setSaving(false);
							return of(
								PluginSettingsActions.createSettingFailure({ error: error.message || 'Unknown error' })
							);
						})
					)
				)
			);
		},
		{ dispatch: true }
	);

	updateSetting$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.updateSetting),
				tap(() => this.store.setSaving(true)),
				switchMap(({ pluginId, settingId, updateData }) =>
					this.pluginSettingsService.updateAndValidatePluginSetting(pluginId, settingId, updateData).pipe(
						map(({ setting, validation }) => {
							this.store.setSaving(false);
							return PluginSettingsActions.updateSettingSuccess({ setting, validation });
						}),
						catchError((error) => {
							this.store.setSaving(false);
							return of(
								PluginSettingsActions.updateSettingFailure({ error: error.message || 'Unknown error' })
							);
						})
					)
				)
			);
		},
		{ dispatch: true }
	);

	bulkUpdateSettings$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.bulkUpdateSettings),
				tap(() => this.store.setSaving(true)),
				switchMap(({ pluginId, updates }) =>
					this.pluginSettingsService.bulkUpdatePluginSettings(pluginId, updates).pipe(
						map((settings) => {
							this.store.setSaving(false);
							return PluginSettingsActions.bulkUpdateSettingsSuccess({ settings });
						}),
						catchError((error) => {
							this.store.setSaving(false);
							return of(
								PluginSettingsActions.bulkUpdateSettingsFailure({
									error: error.message || 'Unknown error'
								})
							);
						})
					)
				)
			);
		},
		{ dispatch: true }
	);

	deleteSetting$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.deleteSetting),
				tap(() => this.store.setSaving(true)),
				switchMap(({ settingId }) =>
					this.pluginSettingsService.deleteSetting(settingId).pipe(
						map(() => {
							this.store.setSaving(false);
							return PluginSettingsActions.deleteSettingSuccess({ settingId });
						}),
						catchError((error) => {
							this.store.setSaving(false);
							return of(
								PluginSettingsActions.deleteSettingFailure({ error: error.message || 'Unknown error' })
							);
						})
					)
				)
			);
		},
		{ dispatch: true }
	);

	validateSettings$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.validateSettings),
				tap(() => this.store.setValidating(true)),
				switchMap(({ pluginId, settings }) =>
					this.pluginSettingsService.validateSettingsSchema(pluginId, settings).pipe(
						map(({ valid, errors }) => {
							this.store.setValidating(false);
							return PluginSettingsActions.validateSettingsSuccess({ valid, errors });
						}),
						catchError((error) => {
							this.store.setValidating(false);
							return of(
								PluginSettingsActions.validateSettingsFailure({
									error: error.message || 'Unknown error'
								})
							);
						})
					)
				)
			);
		},
		{ dispatch: true }
	);

	validateSetting$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.validateSetting),
				switchMap(({ pluginId, key, value, template }) =>
					this.pluginSettingsService.validateSetting(pluginId, key, value, template).pipe(
						map(({ valid, errors }) =>
							PluginSettingsActions.validateSettingSuccess({ key, valid, errors })
						),
						catchError((error) =>
							of(
								PluginSettingsActions.validateSettingFailure({
									key,
									error: error.message || 'Unknown error'
								})
							)
						)
					)
				)
			);
		},
		{ dispatch: true }
	);

	resetSettings$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.resetSettings),
				tap(() => this.store.setSaving(true)),
				switchMap(({ pluginId, scope, tenantId, organizationId, userId }) =>
					this.pluginSettingsService
						.resetSettingsToDefault(pluginId, scope, tenantId, organizationId, userId)
						.pipe(
							map((settings) => {
								this.store.setSaving(false);
								return PluginSettingsActions.resetSettingsSuccess({ settings });
							}),
							catchError((error) => {
								this.store.setSaving(false);
								return of(
									PluginSettingsActions.resetSettingsFailure({
										error: error.message || 'Unknown error'
									})
								);
							})
						)
				)
			);
		},
		{ dispatch: true }
	);

	exportSettings$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.exportSettings),
				switchMap(({ pluginId, scope, tenantId, organizationId, userId }) =>
					this.pluginSettingsService.exportSettings(pluginId, scope, tenantId, organizationId, userId).pipe(
						map((blob) => PluginSettingsActions.exportSettingsSuccess({ blob })),
						catchError((error) =>
							of(PluginSettingsActions.exportSettingsFailure({ error: error.message || 'Unknown error' }))
						)
					)
				)
			);
		},
		{ dispatch: true }
	);

	importSettings$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.importSettings),
				switchMap(({ pluginId, file, scope, tenantId, organizationId, userId }) =>
					this.pluginSettingsService
						.importSettings(pluginId, file, scope, tenantId, organizationId, userId)
						.pipe(
							map(({ imported, skipped, errors }) =>
								PluginSettingsActions.importSettingsSuccess({ imported, skipped, errors })
							),
							catchError((error) =>
								of(
									PluginSettingsActions.importSettingsFailure({
										error: error.message || 'Unknown error'
									})
								)
							)
						)
				)
			);
		},
		{ dispatch: true }
	);

	// Store updates based on actions
	loadSettingsSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.loadSettingsSuccess),
				tap(({ settings }) => {
					this.store.setSettings(settings);
				})
			);
		},
		{ dispatch: false }
	);

	loadGroupedSettingsSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.loadGroupedSettingsSuccess),
				tap(({ settingsGroups }) => {
					this.store.setSettingsGroups(settingsGroups);
				})
			);
		},
		{ dispatch: false }
	);

	createSettingSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.createSettingSuccess),
				tap(({ setting }) => {
					this.store.addSetting(setting);
				})
			);
		},
		{ dispatch: false }
	);

	updateSettingSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.updateSettingSuccess),
				tap(({ setting, validation }) => {
					this.store.updateSetting(setting.id, setting);
					if (validation && !validation.valid && validation.errors) {
						this.store.setValidationError(setting.key, validation.errors);
					} else {
						this.store.setValidationError(setting.key, []);
					}
				})
			);
		},
		{ dispatch: false }
	);

	bulkUpdateSettingsSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.bulkUpdateSettingsSuccess),
				tap(({ settings }) => {
					this.store.setSettings(settings);
					this.store.clearUnsavedChanges();
				})
			);
		},
		{ dispatch: false }
	);

	deleteSettingSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.deleteSettingSuccess),
				tap(({ settingId }) => {
					this.store.removeSetting(settingId);
				})
			);
		},
		{ dispatch: false }
	);

	validateSettingsSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.validateSettingsSuccess),
				tap(({ errors }) => {
					const validationErrors: Record<string, string[]> = {};
					errors.forEach(({ key, errors: fieldErrors }) => {
						validationErrors[key] = fieldErrors;
					});
					this.store.setValidationErrors(validationErrors);
				})
			);
		},
		{ dispatch: false }
	);

	validateSettingSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.validateSettingSuccess),
				tap(({ key, errors }) => {
					this.store.setValidationError(key, errors);
				})
			);
		},
		{ dispatch: false }
	);

	resetSettingsSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.resetSettingsSuccess),
				tap(({ settings }) => {
					this.store.setSettings(settings);
					this.store.clearValidationErrors();
				})
			);
		},
		{ dispatch: false }
	);

	// Error handling
	handleError$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(
					PluginSettingsActions.loadSettingsFailure,
					PluginSettingsActions.loadGroupedSettingsFailure,
					PluginSettingsActions.createSettingFailure,
					PluginSettingsActions.updateSettingFailure,
					PluginSettingsActions.bulkUpdateSettingsFailure,
					PluginSettingsActions.deleteSettingFailure,
					PluginSettingsActions.validateSettingsFailure,
					PluginSettingsActions.resetSettingsFailure,
					PluginSettingsActions.exportSettingsFailure,
					PluginSettingsActions.importSettingsFailure
				),
				tap((action) => {
					this.store.setErrorMessage(action.error);
					console.error('Plugin settings operation failed:', action.error);
				})
			);
		},
		{ dispatch: false }
	);

	// UI state management
	selectPlugin$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.selectPlugin),
				tap(({ pluginId, scope }) => {
					this.store.selectPlugin(pluginId, scope);
				})
			);
		},
		{ dispatch: false }
	);

	clearSelection$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.clearSelection),
				tap(() => {
					this.store.clearSelection();
				})
			);
		},
		{ dispatch: false }
	);

	setSearchTerm$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.setSearchTerm),
				tap(({ searchTerm }) => {
					this.store.setSearchTerm(searchTerm);
				})
			);
		},
		{ dispatch: false }
	);

	setSelectedCategory$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.setSelectedCategory),
				tap(({ selectedCategory }) => {
					this.store.setSelectedCategory(selectedCategory);
				})
			);
		},
		{ dispatch: false }
	);

	toggleAdvancedSettings$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.toggleAdvancedSettings),
				tap(() => {
					this.store.toggleAdvancedSettings();
				})
			);
		},
		{ dispatch: false }
	);

	setAdvancedSettings$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.setAdvancedSettings),
				tap(({ showAdvancedSettings }) => {
					this.store.setAdvancedSettings(showAdvancedSettings);
				})
			);
		},
		{ dispatch: false }
	);

	markUnsavedChanges$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.markUnsavedChanges),
				tap(() => {
					this.store.markUnsavedChanges();
				})
			);
		},
		{ dispatch: false }
	);

	clearUnsavedChanges$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.clearUnsavedChanges),
				tap(() => {
					this.store.clearUnsavedChanges();
				})
			);
		},
		{ dispatch: false }
	);

	clearSettings$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.clearSettings),
				tap(() => {
					this.store.clearSettings();
				})
			);
		},
		{ dispatch: false }
	);

	clearError$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.clearError),
				tap(() => {
					this.store.clearError();
				})
			);
		},
		{ dispatch: false }
	);

	clearValidationErrors$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.clearValidationErrors),
				tap(() => {
					this.store.clearValidationErrors();
				})
			);
		},
		{ dispatch: false }
	);

	setValidationError$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.setValidationError),
				tap(({ settingKey, errors }) => {
					this.store.setValidationError(settingKey, errors);
				})
			);
		},
		{ dispatch: false }
	);
}

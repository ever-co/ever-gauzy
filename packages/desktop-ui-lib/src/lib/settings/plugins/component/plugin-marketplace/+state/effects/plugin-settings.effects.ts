import { Injectable } from '@angular/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { createEffect, ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { catchError, exhaustMap, map, of, switchMap, tap } from 'rxjs';
import { PluginSettingsService } from '../../../../services/plugin-settings.service';
import { PluginCreateSettingDialogComponent } from '../../plugin-create-setting-dialog/plugin-create-setting-dialog.component';
import { PluginSettingsManagementComponent } from '../../plugin-settings-management/plugin-settings-management.component';
import { PluginSettingsActions } from '../actions/plugin-settings.actions';
import { PluginSettingsStore } from '../stores/plugin-settings.store';

@Injectable({ providedIn: 'root' })
export class PluginSettingsEffects {
	constructor(
		private readonly actions$: Actions,
		private readonly pluginSettingsService: PluginSettingsService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: NbToastrService,
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
				switchMap(({ setting }) =>
					this.pluginSettingsService.createSetting(setting).pipe(
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
				switchMap(({ pluginId, settingId }) =>
					this.pluginSettingsService.deleteSetting(pluginId, settingId).pipe(
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
				switchMap(({ pluginId, settings }) => {
					// Convert array format to Record if needed
					let settingsRecord: Record<string, any>;
					if (Array.isArray(settings)) {
						settingsRecord = {};
						for (const item of settings) {
							settingsRecord[item.key] = item.value;
						}
					} else {
						settingsRecord = settings;
					}

					return this.pluginSettingsService.validateSettingsSchema(pluginId, settingsRecord).pipe(
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
					);
				})
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
					// Also flatten and store in entity store for filtering
					const flattenedSettings = settingsGroups.flatMap((group) => group.settings);
					if (flattenedSettings.length > 0) {
						this.store.set(flattenedSettings);
					}
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

					// Update settingsGroups to ensure filteredGroups$ reflects the change
					const currentGroups = this.store.getValue().settingsGroups;
					const updatedGroups = currentGroups.map((group) => {
						// Add setting to matching group based on category
						if (
							group.category === setting.category ||
							(setting.category === undefined && group.category === 'General')
						) {
							return {
								...group,
								settings: [...group.settings, setting]
							};
						}
						return group;
					});

					// Create new group if no matching group exists
					const hasMatchingGroup = updatedGroups.some((group) =>
						group.settings.some((s) => s.id === setting.id)
					);
					if (!hasMatchingGroup) {
						updatedGroups.push({
							category: setting.category || 'General',
							label: setting.category || 'General',
							description: '',
							icon: '',
							order: updatedGroups.length,
							settings: [setting]
						});
					}

					this.store.setSettingsGroups(updatedGroups);
					this.toastrService.success('Setting created successfully', 'Success');
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
						this.toastrService.warning('Setting updated with validation errors', 'Warning');
					} else {
						this.store.setValidationError(setting.key, []);
						this.toastrService.success('Setting updated successfully', 'Success');
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
					this.toastrService.success('Settings updated successfully', 'Success');
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

					// Update settingsGroups to ensure filteredGroups$ reflects the change
					const currentGroups = this.store.getValue().settingsGroups;
					const updatedGroups = currentGroups
						.map((group) => ({
							...group,
							settings: group.settings.filter((setting) => setting.id !== settingId)
						}))
						.filter((group) => group.settings.length > 0); // Remove empty groups

					this.store.setSettingsGroups(updatedGroups);
					this.toastrService.success('Setting deleted successfully', 'Success');
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

					if (errors.length > 0) {
						this.toastrService.warning('Validation failed for some settings', 'Validation');
					} else {
						this.toastrService.success('All settings are valid', 'Validation');
					}
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
					this.toastrService.success('Settings reset successfully', 'Success');
				})
			);
		},
		{ dispatch: false }
	);

	exportSettingsSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.exportSettingsSuccess),
				tap(() => {
					this.toastrService.success('Settings exported successfully', 'Success');
				})
			);
		},
		{ dispatch: false }
	);

	importSettingsSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.importSettingsSuccess),
				tap(({ imported, skipped, errors }) => {
					if (errors && errors.length > 0) {
						this.toastrService.warning(
							`Imported ${imported} settings. Skipped ${skipped}. Errors: ${errors.length}`,
							'Import Completed with Warnings'
						);
					} else {
						this.toastrService.success(
							`Imported ${imported} settings. Skipped ${skipped}.`,
							'Import Successful'
						);
					}
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
					PluginSettingsActions.validateSettingFailure,
					PluginSettingsActions.resetSettingsFailure,
					PluginSettingsActions.exportSettingsFailure,
					PluginSettingsActions.importSettingsFailure
				),
				tap((action) => {
					this.store.setErrorMessage(action.error);
					console.error('Plugin settings operation failed:', action.error);
					this.toastrService.danger(action.error, 'Error');
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

	openSettings$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.openSettings),
				exhaustMap(
					({ plugin }) =>
						this.dialogService.open(PluginSettingsManagementComponent, {
							context: {
								plugin
							}
						}).onClose
				)
			);
		},
		{ dispatch: false }
	);

	openCreateSettingDialog$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.openCreateSettingDialog),
				exhaustMap(
					({ pluginId }) =>
						this.dialogService.open(PluginCreateSettingDialogComponent, {
							context: {
								data: {
									pluginId
								}
							}
						}).onClose
				)
			);
		},
		{ dispatch: false }
	);

	// Edit mode effects
	startEditSetting$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.startEditSetting),
				tap(({ settingKey, currentValue }) => {
					this.store.startEditSetting(settingKey, currentValue);
				})
			);
		},
		{ dispatch: false }
	);

	updateEditFormValue$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.updateEditFormValue),
				tap(({ settingKey, value }) => {
					this.store.updateEditFormValue(settingKey, value);
				})
			);
		},
		{ dispatch: false }
	);

	saveSettingEdit$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.saveSettingEdit),
				tap(({ settingKey }) => {
					this.store.saveSettingEdit(settingKey);
				}),
				map(({ settingKey }) => PluginSettingsActions.saveSettingEditSuccess({ settingKey }))
			);
		},
		{ dispatch: true }
	);

	saveSettingEditSuccess$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.saveSettingEditSuccess),
				tap(({ settingKey }) => {
					this.store.completeSavingSettingEdit(settingKey);
					this.store.markUnsavedChanges();
				})
			);
		},
		{ dispatch: false }
	);

	cancelSettingEdit$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.cancelSettingEdit),
				tap(({ settingKey }) => {
					this.store.cancelSettingEdit(settingKey);
				})
			);
		},
		{ dispatch: false }
	);

	clearEditState$ = createEffect(
		() => {
			return this.actions$.pipe(
				ofType(PluginSettingsActions.clearEditState),
				tap(() => {
					this.store.clearEditState();
				})
			);
		},
		{ dispatch: false }
	);
}

import { AfterViewInit, ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IPlugin, IUser } from '@gauzy/contracts';
import { NB_DIALOG_CONFIG, NbBadgeModule, NbButtonModule, NbCardModule, NbDialogRef, NbDialogService, NbFormFieldModule, NbIconModule, NbInputModule, NbSpinnerModule, NbTabsetModule, NbToggleModule, NbTooltipModule } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Angular2SmartTableModule, Cell, LocalDataSource } from 'angular2-smart-table';
import { combineLatest, debounceTime, distinctUntilChanged, filter, map, Observable, startWith, switchMap, take, tap } from 'rxjs';
import { UserManagementDialogViewModel, UserManagementFacade } from '../+state/facades/user-management.facade';
import { PluginUserAssignment } from '../+state/stores/plugin-user-assignment.store';
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';
import { Store } from '../../../../../services';
import { PaginationComponent } from '../../../../../time-tracker/pagination/pagination.component';

import { AsyncPipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SpinnerButtonDirective } from '../../../../../directives/spinner-button.directive';
import { AssignActionCellComponent } from './render/assign-action/assign-action-cell.component';
import { UserCellComponent } from './render/user-cell/user-cell.component';
import { PluginAssignedUsersTableService } from './services/plugin-assigned-users-table.service';

/** Row data representing a user toggle action */
export interface PluginUserRow {
	userId?: string;
	newState: boolean;
	[key: string]: unknown;
}

export interface PluginUserManagementDialogData {
	plugin: IPlugin;
	subscriptionId?: string;
}

/**
 * Plugin User Management Component
 *
 * Responsibilities (Single Responsibility Principle):
 * - Present user management UI
 * - Handle user interactions
 * - Delegate business logic to facade
 *
 * Design Patterns:
 * - Facade Pattern: Uses facade for all business operations
 * - Observer Pattern: Reactive UI with observables
 * - Presentation Pattern: Thin controller, delegates to facade
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Only handles UI presentation
 * - Open/Closed: Can extend without modifying
 * - Dependency Inversion: Depends on abstractions (facade)
 * - Interface Segregation: Uses focused interfaces
 */
@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'lib-plugin-user-management',
    templateUrl: './plugin-user-management.component.html',
    styleUrls: ['./plugin-user-management.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
		NbCardModule, NbIconModule, NbBadgeModule, NbTabsetModule,
		FormsModule, ReactiveFormsModule, NbFormFieldModule, NbInputModule,
		NbButtonModule, NbSpinnerModule, SpinnerButtonDirective, NbTooltipModule, NbToggleModule,
		Angular2SmartTableModule, PaginationComponent, AsyncPipe, TranslatePipe
	]
})
export class PluginUserManagementComponent implements OnInit, AfterViewInit, OnDestroy {
	public plugin: IPlugin;
	public subscriptionId?: string;
	public assignmentForm: FormGroup;
	public searchForm: FormGroup;

	// View Model - Single source of truth for UI state
	public viewModel$: Observable<UserManagementDialogViewModel>;

	// Loading observables for template
	public loadingAvailableUsers$: Observable<boolean>;
	public loading$: Observable<boolean>;

	// Selected count observable for template
	public selectedCount$: Observable<number>;

	// Smart table sources
	public readonly availableUsersSource = new LocalDataSource([]);
	public readonly assignedUsersSource = new LocalDataSource([]);

	// Smart table settings
	public availableUsersSettings: Record<string, unknown>;
	public assignedUsersSettings: Record<string, unknown>;

	public submitting = false;

	// Total assigned count for template binding
	public totalCount$: Observable<number>;

	constructor(
		@Inject(NB_DIALOG_CONFIG) public data: PluginUserManagementDialogData,
		private readonly dialogRef: NbDialogRef<PluginUserManagementComponent>,
		private readonly dialogService: NbDialogService,
		private readonly formBuilder: FormBuilder,
		private readonly facade: UserManagementFacade,
		private readonly store: Store,
		private readonly assignedUsersTableService: PluginAssignedUsersTableService,
		private readonly translateService: TranslateService
	) {
		this.plugin = this.data.plugin;
		this.subscriptionId = this.data.subscriptionId;
	}

	ngOnInit(): void {
		this.buildSmartTableSettings();
		this.initializeForms();
		this.initializeObservables();
		this.loadInitialData();
		this.setupSearch();
	}

	ngAfterViewInit(): void {
		this.bindSourcesToStreams();
	}

	ngOnDestroy(): void {
		// Cleanup handled by @UntilDestroy decorator
		this.facade.clearSelection();
	}

	// ============================================================================
	// INITIALIZATION
	// ============================================================================

	/**
	 * Initialize forms
	 * Follows Form Builder Pattern
	 */
	private initializeForms(): void {
		this.assignmentForm = this.formBuilder.group({
			userIds: [[], Validators.required],
			reason: ['', [Validators.maxLength(500)]]
		});

		this.searchForm = this.formBuilder.group({
			searchTerm: ['']
		});
	}

	/**
	 * Initialize observables from facade
	 * Single source of truth principle
	 */
	private initializeObservables(): void {
		// Get complete view model
		this.viewModel$ = this.facade.viewModel$;

		// Loading states
		this.loadingAvailableUsers$ = this.facade.loadingAvailableUsers$;
		this.loading$ = this.facade.loadingAssignedUsers$;

		// Selected count for badge/button text
		this.selectedCount$ = this.facade.selectedUsers$.pipe(map((users) => users.length));

		// Total assigned count (initialized once, not recreated per change-detection)
		this.totalCount$ = this.facade.assignedUsers$.pipe(map((assignments) => assignments.length));
	}

	/**
	 * Build smart table settings for both tables
	 */
	private buildSmartTableSettings(): void {
		this.availableUsersSettings = {
			columns: {
				_user: {
					title: 'User',
					type: 'custom',
					renderComponent: UserCellComponent,
					componentInitFunction: (instance: UserCellComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				},
				email: {
					title: 'Email'
				},
				_action: {
					title: '',
					type: 'custom',
					width: '60px',
					filter: false,
					sort: false,
					renderComponent: AssignActionCellComponent,
					componentInitFunction: (instance: AssignActionCellComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.toggle.pipe(untilDestroyed(this)).subscribe((rowData) => {
							if (rowData.selected) {
								this.onUserDeselect(rowData as IUser);
							} else {
								this.onUserSelect(rowData as IUser);
							}
						});
					}
				}
			},
			hideSubHeader: true,
			actions: false,
				noDataMessage: this.translateService.instant('PLUGIN.USER_MANAGEMENT.NO_USERS_AVAILABLE'),
			pager: {
				display: false,
				perPage: 10,
				page: 1
			}
		};

		this.assignedUsersSettings = this.assignedUsersTableService.buildSettings({
			onToggle: (rowData) => this.onToggleUserAccess(rowData),
			onUnassign: (assignment) => this.onUnassignUser(assignment),
			pipeUntilDestroyed: (obs) => obs.pipe(untilDestroyed(this))
		});
	}

	/**
	 * Bind reactive streams to LocalDataSources so smart tables stay in sync
	 */
	private bindSourcesToStreams(): void {
		// Available users: merge filtered users + selected IDs to produce rows with `selected` flag
		const filteredAvailableUsers$ = this.facade.filteredAvailableUsers$.pipe(
			map((users) => users.filter((u) => u.id !== this.store.userId))
		);

		combineLatest([filteredAvailableUsers$, this.facade.selectedUserIds$])
			.pipe(untilDestroyed(this))
			.subscribe(([users, selectedIds]) => {
				const rows = users.map((user) => ({
					...user,
					_user: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
					selected: selectedIds.includes(user.id)
				}));
				this.availableUsersSource.load(rows);
			});

		// Assigned users: delegate row mapping to shared service
		this.facade.assignedUsers$
			.pipe(untilDestroyed(this))
			.subscribe((assignments) => {
				this.assignedUsersSource.load(
					assignments.map((a) => this.assignedUsersTableService.mapAssignmentToRow(a))
				);
			});
	}

	/**
	 * Load initial data from facade
	 * Delegates to facade for business logic
	 */
	private loadInitialData(): void {
		const organizationId = this.store.organizationId;
		const tenantId = this.store.tenantId;
		this.facade.loadAssignedUsers(this.plugin.id, this.subscriptionId, false);
		this.facade.setOrganizationContext(organizationId, tenantId);
		this.facade.loadAvailableUsers(organizationId, tenantId, 0, 20);
	}

	/**
	 * Setup search functionality
	 * Debounces user input for better performance
	 */
	private setupSearch(): void {
		this.searchForm
			.get('searchTerm')
			?.valueChanges.pipe(
				startWith(''),
				debounceTime(300),
				distinctUntilChanged(),
				tap((term) => {
					this.facade.setSearchTerm(term || '');
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	// ============================================================================
	// USER SELECTION
	// ============================================================================

	/**
	 * Handle user selection
	 * Delegates to facade
	 * @param user - User to select
	 */
	public onUserSelect(user: IUser): void {
		if (!this.facade.isUserSelected(user.id)) {
			this.facade.selectUser(user.id);
			this.facade.selectedUserIds$
				.pipe(
					tap((ids) => this.assignmentForm.patchValue({ userIds: ids })),
					untilDestroyed(this)
				)
				.subscribe();
		}
	}

	/**
	 * Handle user deselection
	 * Delegates to facade
	 * @param user - User to deselect
	 */
	public onUserDeselect(user: IUser): void {
		this.facade.deselectUser(user.id);
		this.facade.selectedUserIds$
			.pipe(
				tap((ids) => this.assignmentForm.patchValue({ userIds: ids })),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Check if user is selected
	 * @param user - User to check
	 */
	public isUserSelected(user: IUser): boolean {
		return this.facade.isUserSelected(user.id);
	}

	// ============================================================================
	// USER ASSIGNMENT
	// ============================================================================

	/**
	 * Handle user assignment
	 * Validates form and delegates to facade
	 */
	public onAssignUsers(): void {
		if (this.assignmentForm.valid && !this.submitting) {
			this.submitting = true;
			const formValue = this.assignmentForm.value;

			this.facade.assignUsers(
				this.plugin.id,
				formValue.userIds,
				formValue.reason || 'Manual assignment via user management dialog'
			);

			// Wait for completion
			this.facade.loadingAssignedUsers$
				.pipe(
					filter((loading) => !loading),
					take(1),
					tap(() => {
						this.submitting = false;
						// Reset form on success
						this.assignmentForm.reset();
						this.facade.clearSelection();

						// Reload assigned users
						this.facade.loadAssignedUsers(this.plugin.id, this.subscriptionId, false);
					}),
					untilDestroyed(this)
				)
				.subscribe();
		}
	}

	/**
	 * Toggle user access to the plugin (enable / disable)
	 * @param rowData - Row data including userId and newState
	 */
	public onToggleUserAccess(rowData: PluginUserRow): void {
		const pluginTenantId = this.facade.currentPluginTenantId;
		if (!pluginTenantId || !rowData.userId) return;
		if (rowData.newState) {
			this.facade.enableUser(pluginTenantId, rowData.userId);
		} else {
			this.facade.disableUser(pluginTenantId, rowData.userId);
		}
	}

	/**
	 * Enable access for all assigned users in the organization
	 */
	public onEnableAllUsers(): void {
		const pluginTenantId = this.facade.currentPluginTenantId;
		if (!pluginTenantId) return;
		this.facade.assignedUsers$
			.pipe(
				take(1),
				tap((assignments) => {
					const userIds = assignments.map((a) => a.userId);
					if (userIds.length > 0) {
						this.facade.enableAllUsers(pluginTenantId, userIds);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Disable access for all assigned users in the organization
	 */
	public onDisableAllUsers(): void {
		const pluginTenantId = this.facade.currentPluginTenantId;
		if (!pluginTenantId) return;
		this.facade.assignedUsers$
			.pipe(
				take(1),
				tap((assignments) => {
					const userIds = assignments.map((a) => a.userId);
					if (userIds.length > 0) {
						this.facade.disableAllUsers(pluginTenantId, userIds);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Handle user unassignment
	 * Shows confirmation dialog and delegates to facade
	 * @param assignment - Assignment to remove
	 */
	public onUnassignUser(assignment: PluginUserAssignment): void {
		this.dialogService
			.open(AlertComponent, {
				context: {
					data: {
						title: 'Unassign User',
						message: `Are you sure you want to unassign ${this.getUserDisplayName(
							assignment
						)} from this plugin?`,
						confirmText: 'Unassign',
						dismissText: 'Cancel'
					}
				}
			})
			.onClose.pipe(
				filter(Boolean),
				take(1),
				switchMap(() => {
					this.facade.unassignUser(this.plugin.id, assignment.userId);

					// Wait for completion and reload
					return this.facade.loadingAssignedUsers$.pipe(
						filter((loading) => !loading),
						tap(() => {
							this.facade.loadAssignedUsers(this.plugin.id, this.subscriptionId, false);
						})
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	// ============================================================================
	// INFINITE SCROLL
	// ============================================================================

	/**
	 * Load more available users for infinite scroll
	 * Delegates to facade
	 */
	public onLoadMoreAvailableUsers(): void {
		const organizationId = this.store.organizationId;
		const tenantId = this.store.tenantId;
		console.log('[PluginUserManagementComponent] Loading more users');
		this.facade.loadMoreAvailableUsers(organizationId, tenantId);
	}

	// ============================================================================
	// UI HELPERS
	// ============================================================================

	/**
	 * Get user display name
	 * Delegates to facade
	 * @param assignment - Plugin user assignment
	 */
	public getUserDisplayName(assignment: PluginUserAssignment): string {
		return this.facade.getUserDisplayName(assignment);
	}

	/**
	 * Get assigned users total count observable
	 */
	public getTotalAssignedCount(): Observable<number> {
		return this.totalCount$;
	}

	// ============================================================================
	// DIALOG ACTIONS
	// ============================================================================

	/**
	 * Close dialog
	 */
	public close(): void {
		this.dialogRef.close();
	}

	/**
	 * Save and close dialog
	 */
	public save(): void {
		this.dialogRef.close(true);
	}
}

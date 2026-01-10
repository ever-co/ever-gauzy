import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IPlugin, IUser } from '@gauzy/contracts';
import { NB_DIALOG_CONFIG, NbDialogRef, NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, distinctUntilChanged, filter, map, Observable, startWith, switchMap, take, tap } from 'rxjs';
import { UserManagementDialogViewModel, UserManagementFacade } from '../+state/facades/user-management.facade';
import { PluginUserAssignment } from '../+state/stores/plugin-user-assignment.store';
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';
import { Store } from '../../../../../services';

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
	standalone: false
})
export class PluginUserManagementComponent implements OnInit, OnDestroy {
	public plugin: IPlugin;
	public subscriptionId?: string;
	public assignmentForm: FormGroup;
	public searchForm: FormGroup;

	// View Model - Single source of truth for UI state
	public viewModel$: Observable<UserManagementDialogViewModel>;

	// Individual observables for template convenience
	public filteredAvailableUsers$: Observable<IUser[]>;
	public assignedUsers$: Observable<PluginUserAssignment[]>;
	public selectedUsers$: Observable<IUser[]>;
	public loadingAvailableUsers$: Observable<boolean>;
	public loadingMoreAvailableUsers$: Observable<boolean>;
	public hasMoreAvailableUsers$: Observable<boolean>;
	public loading$: Observable<boolean>;

	public submitting = false;

	constructor(
		@Inject(NB_DIALOG_CONFIG) public data: PluginUserManagementDialogData,
		private readonly dialogRef: NbDialogRef<PluginUserManagementComponent>,
		private readonly dialogService: NbDialogService,
		private readonly formBuilder: FormBuilder,
		private readonly facade: UserManagementFacade,
		private readonly store: Store
	) {
		this.plugin = this.data.plugin;
		this.subscriptionId = this.data.subscriptionId;
	}

	ngOnInit(): void {
		this.initializeForms();
		this.initializeObservables();
		this.loadInitialData();
		this.setupSearch();
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

		// Expose individual streams for template convenience
		this.filteredAvailableUsers$ = this.facade.filteredAvailableUsers$.pipe(
			map((users) => users.filter((user) => user.id !== this.store.userId))
		);
		this.assignedUsers$ = this.facade.assignedUsers$;
		this.selectedUsers$ = this.facade.selectedUsers$;
		this.loadingAvailableUsers$ = this.facade.loadingAvailableUsers$;
		this.loadingMoreAvailableUsers$ = this.facade.loadingMoreAvailableUsers$;
		this.hasMoreAvailableUsers$ = this.facade.hasMoreAvailableUsers$;
		this.loading$ = this.facade.loadingAssignedUsers$;
	}

	/**
	 * Load initial data from facade
	 * Delegates to facade for business logic
	 */
	private loadInitialData(): void {
		const organizationId = this.store.organizationId;
		const tenantId = this.store.tenantId;
		// Load assigned users
		this.facade.loadAssignedUsers(this.plugin.id, this.subscriptionId, false);

		// Load available users with organization context
		console.log('[PluginUserManagementComponent] Loading available users for org:', organizationId);
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
					console.log('[PluginUserManagementComponent] Search term changed:', term);
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

			// Update form
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

		// Update form
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
	 * Get user avatar URL
	 * Delegates to facade
	 * @param user - User object
	 */
	public getUserAvatar(user: IUser | PluginUserAssignment['user']): string {
		return this.facade.getUserAvatar(user as IUser);
	}

	/**
	 * Get selected users observable
	 */
	public getSelectedUsers(): Observable<IUser[]> {
		return this.facade.selectedUsers$;
	}

	/**
	 * Get total assigned count
	 */
	public getTotalAssignedCount(): Observable<number> {
		return this.facade.assignedUsers$.pipe(map((assignments) => assignments.length));
	}

	/**
	 * Get assignment date
	 * Returns null if no valid date is available
	 * Delegates to facade
	 * @param assignment - Plugin user assignment
	 */
	public getAssignmentDate(assignment: PluginUserAssignment): Date | null {
		return this.facade.getAssignmentDate(assignment);
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

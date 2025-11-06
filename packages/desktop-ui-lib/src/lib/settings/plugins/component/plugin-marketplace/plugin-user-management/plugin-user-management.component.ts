import { ChangeDetectionStrategy, Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IPlugin, IUser, IUserOrganization } from '@gauzy/contracts';
import { NB_DIALOG_CONFIG, NbDialogRef, NbDialogService } from '@nebular/theme';
import { Actions } from '@ngneat/effects-ng';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	BehaviorSubject,
	catchError,
	combineLatest,
	debounceTime,
	distinctUntilChanged,
	filter,
	from,
	map,
	Observable,
	of,
	startWith,
	switchMap,
	tap
} from 'rxjs';
import { PluginUserAssignmentActions } from '../+state/actions/plugin-user-assignment.actions';
import { PluginUserAssignmentQuery } from '../+state/queries/plugin-user-assignment.query';
import { PluginUserAssignment } from '../+state/stores/plugin-user-assignment.store';
import { AlertComponent } from '../../../../../dialogs/alert/alert.component';
import { Store } from '../../../../../services';
import { UserOrganizationService } from '../../../../../time-tracker/organization-selector/user-organization.service';

export interface PluginUserManagementDialogData {
	plugin: IPlugin;
	installationId: string;
}

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
	public installationId: string;
	public assignmentForm: FormGroup;
	public searchForm: FormGroup;

	// Search and filter
	private readonly searchTerm$ = new BehaviorSubject<string>('');
	private readonly selectedUsers$ = new BehaviorSubject<IUser[]>([]);

	// Available users (filtered by search)
	public availableUsers$: Observable<IUser[]>;
	public assignedUsers$: Observable<PluginUserAssignment[]>;
	public filteredAvailableUsers$: Observable<IUser[]>;

	// Loading states
	public loading$ = this.query.loading$;
	public loadingMore$ = this.query.loadingMore$;
	public hasMore$ = this.query.hasMore$;
	public submitting = false;

	constructor(
		@Inject(NB_DIALOG_CONFIG) public data: PluginUserManagementDialogData,
		private readonly dialogRef: NbDialogRef<PluginUserManagementComponent>,
		private readonly dialogService: NbDialogService,
		private readonly formBuilder: FormBuilder,
		private readonly actions: Actions,
		private readonly query: PluginUserAssignmentQuery,
		private readonly store: Store,
		private readonly userOrganizationService: UserOrganizationService
	) {
		this.plugin = this.data.plugin;
		this.installationId = this.data.installationId;
		this.initializeForms();
	}

	ngOnInit(): void {
		// Load current assignments with pagination
		this.actions.dispatch(
			PluginUserAssignmentActions.loadAssignments({
				pluginId: this.plugin.id,
				installationId: this.installationId,
				includeInactive: false,
				skip: 0,
				take: 20
			})
		);

		// Set up data streams
		this.setupDataStreams();

		// Set up search functionality
		this.setupSearch();
	}

	ngOnDestroy(): void {
		this.selectedUsers$.complete();
		this.searchTerm$.complete();
	}

	private initializeForms(): void {
		this.assignmentForm = this.formBuilder.group({
			userIds: [[], Validators.required],
			reason: ['', [Validators.maxLength(500)]]
		});

		this.searchForm = this.formBuilder.group({
			searchTerm: ['']
		});
	}

	private setupDataStreams(): void {
		// Get assigned users for this installation
		this.assignedUsers$ = this.query.getAssignmentsForInstallation(this.installationId);

		// Get all available users from the organization using the action states service
		this.availableUsers$ = this.loadOrganizationUsers();

		// Filter available users by search term and exclude already assigned
		this.filteredAvailableUsers$ = combineLatest([
			this.availableUsers$,
			this.assignedUsers$,
			this.searchTerm$
		]).pipe(
			map(([availableUsers, assignedUsers, searchTerm]) => {
				const assignedUserIds = assignedUsers.map((assignment) => assignment.userId);
				let filtered = availableUsers.filter((user) => !assignedUserIds.includes(user.id));

				if (searchTerm.trim()) {
					const term = searchTerm.toLowerCase();
					filtered = filtered.filter(
						(user) =>
							user.firstName?.toLowerCase().includes(term) ||
							user.lastName?.toLowerCase().includes(term) ||
							user.email?.toLowerCase().includes(term)
					);
				}

				return filtered;
			})
		);
	}

	private setupSearch(): void {
		// Handle search term changes
		this.searchForm
			.get('searchTerm')
			?.valueChanges.pipe(
				startWith(''),
				debounceTime(300),
				distinctUntilChanged(),
				tap((term) => this.searchTerm$.next(term || '')),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Load organization users using the users organizations service
	 * @returns Observable of users in the current organization
	 */
	private loadOrganizationUsers(): Observable<IUser[]> {
		// Get current organization from store
		return this.store.selectedOrganization$.pipe(
			filter((organization) => !!organization),
			switchMap((organization) => {
				const { id: organizationId, tenantId } = organization;

				// Convert the promise to observable and handle the user organizations
				return from(
					this.userOrganizationService.getAll(['user', 'user.role'], { organizationId, tenantId }, false)
				).pipe(
					map((userOrganizations) => {
						// Extract users from user organizations and filter active users
						return userOrganizations.items
							.filter((userOrg: IUserOrganization) => userOrg.isActive && userOrg.user)
							.map((userOrg: IUserOrganization) => userOrg.user);
					}),
					// Handle errors gracefully
					catchError((error) => {
						console.error('Error loading organization users:', error);
						return of([]);
					})
				);
			}),
			startWith([]) // Start with empty array while loading
		);
	}

	public onUserSelect(user: IUser): void {
		const currentSelection = this.selectedUsers$.value;
		if (!currentSelection.find((u) => u.id === user.id)) {
			const newSelection = [...currentSelection, user];
			this.selectedUsers$.next(newSelection);
			this.assignmentForm.patchValue({
				userIds: newSelection.map((u) => u.id)
			});
		}
	}

	public onUserDeselect(user: IUser): void {
		const currentSelection = this.selectedUsers$.value;
		const newSelection = currentSelection.filter((u) => u.id !== user.id);
		this.selectedUsers$.next(newSelection);
		this.assignmentForm.patchValue({
			userIds: newSelection.map((u) => u.id)
		});
	}

	public isUserSelected(user: IUser): boolean {
		return this.selectedUsers$.value.some((u) => u.id === user.id);
	}

	public onAssignUsers(): void {
		if (this.assignmentForm.valid && !this.submitting) {
			this.submitting = true;
			const formValue = this.assignmentForm.value;

			this.actions.dispatch(
				PluginUserAssignmentActions.assignUsers({
					pluginId: this.plugin.id,
					userIds: formValue.userIds,
					reason: formValue.reason || 'Manual assignment via user management dialog'
				})
			);

			// Listen for success/failure
			this.query.loading$
				.pipe(
					filter((loading) => !loading),
					tap(() => {
						this.submitting = false;
						// Reset form and selections on success
						if (!this.query.error) {
							this.assignmentForm.reset();
							this.selectedUsers$.next([]);
						}
					}),
					untilDestroyed(this)
				)
				.subscribe();
		}
	}

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
				tap(() => {
					this.actions.dispatch(
						PluginUserAssignmentActions.unassignUser({
							pluginId: this.plugin.id,
							userId: assignment.userId
						})
					);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	public getUserDisplayName(assignment: PluginUserAssignment): string {
		if (assignment.user) {
			const { firstName, lastName, email } = assignment.user;
			if (firstName || lastName) {
				return `${firstName || ''} ${lastName || ''}`.trim();
			}
			return email;
		}
		return 'Unknown User';
	}

	public getUserAvatar(user: IUser | PluginUserAssignment['user']): string {
		return user?.imageUrl || '/assets/images/avatars/default-avatar.png';
	}

	public getSelectedUsers(): Observable<IUser[]> {
		return this.selectedUsers$.asObservable();
	}

	public getTotalAssignedCount(): Observable<number> {
		return this.assignedUsers$.pipe(map((assignments) => assignments.length));
	}

	public getAssignmentDate(assignment: PluginUserAssignment): Date {
		return new Date(assignment.assignedAt);
	}

	public close(): void {
		this.dialogRef.close();
	}

	public save(): void {
		this.dialogRef.close(true);
	}

	/**
	 * Load more assignments for infinite scroll
	 */
	public onLoadMoreAssignments(): void {
		const hasMore = this.query.hasMore;
		const loadingMore = this.query.loadingMore;

		if (!hasMore || loadingMore) {
			return;
		}

		this.actions.dispatch(
			PluginUserAssignmentActions.loadMoreAssignments({
				pluginId: this.plugin.id,
				installationId: this.installationId,
				includeInactive: false
			})
		);
	}
}

import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IPlugin, IUser } from '@gauzy/contracts';
import { Actions } from '@ngneat/effects-ng';
import { BehaviorSubject, distinctUntilChanged, filter, Observable, Subject, takeUntil, tap } from 'rxjs';
import { PluginUserAssignmentActions } from '../../../+state/actions/plugin-user-assignment.actions';
import { PluginSubscriptionAccessFacade } from '../../../+state/plugin-subscription-access.facade';
import { PluginMarketplaceQuery } from '../../../+state/queries/plugin-marketplace.query';
import { PluginUserAssignmentQuery } from '../../../+state/queries/plugin-user-assignment.query';
import { PluginVersionQuery } from '../../../+state/queries/plugin-version.query';
import { PluginUserAssignment } from '../../../+state/stores/plugin-user-assignment.store';

@Component({
	selector: 'gauzy-plugin-user-management-tab',
	standalone: false,
	templateUrl: './user-management-tab.component.html',
	styleUrls: ['./user-management-tab.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserManagementTabComponent implements OnInit, OnDestroy {
	private readonly destroy$ = new Subject<void>();
	private readonly searchTerm$ = new BehaviorSubject<string>('');

	plugin$: Observable<IPlugin>;
	assignedUsers$: Observable<PluginUserAssignment[]>;
	canAssign$: Observable<boolean>;
	loading$ = this.userAssignmentQuery.loading$;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly actions: Actions,
		private readonly marketplaceQuery: PluginMarketplaceQuery,
		private readonly versionQuery: PluginVersionQuery,
		private readonly accessFacade: PluginSubscriptionAccessFacade,
		private readonly userAssignmentQuery: PluginUserAssignmentQuery
	) {
		this.plugin$ = this.marketplaceQuery.plugin$;
	}

	ngOnInit(): void {
		// Set up data streams
		this.setupDataStreams();
	}

	ngOnDestroy(): void {
		this.destroy$.next();
		this.destroy$.complete();
		this.searchTerm$.complete();
	}

	private setupDataStreams(): void {
		// Load assignments when plugin and installation are available
		this.plugin$
			.pipe(
				filter(Boolean),
				distinctUntilChanged((prev, curr) => prev.id === curr.id),
				tap((plugin) => {
					// Check permissions
					this.canAssign$ = this.accessFacade.canAssign$(plugin.id);

					// Load assignments (assuming installationId is available or derived)
					// For now, we'll load based on pluginId only
					this.actions.dispatch(
						PluginUserAssignmentActions.loadAssignments({
							pluginId: plugin.id,
							installationId: '', // Update this if you have installation context
							includeInactive: false
						})
					);
				}),
				takeUntil(this.destroy$)
			)
			.subscribe();

		// Get assigned users - show all assignments for this plugin across all installations
		this.assignedUsers$ = this.userAssignmentQuery.assignments$;
	}

	showAssignmentDialog(): void {
		const plugin = this.marketplaceQuery.plugin;
		if (!plugin) return;

		this.accessFacade.showAssignmentDialog(plugin.id);
	}

	onSearchChange(searchTerm: string): void {
		this.searchTerm$.next(searchTerm);
	}

	getUserDisplayName(assignment: PluginUserAssignment): string {
		if (assignment.user) {
			const { firstName, lastName, email } = assignment.user;
			if (firstName || lastName) {
				return `${firstName || ''} ${lastName || ''}`.trim();
			}
			return email;
		}
		return 'Unknown User';
	}

	getUserAvatar(user: IUser | PluginUserAssignment['user']): string {
		return user?.imageUrl || '/assets/images/avatars/default-avatar.png';
	}

	getAssignmentDate(assignment: PluginUserAssignment): Date {
		return new Date(assignment.assignedAt);
	}

	onUnassignUser(assignment: PluginUserAssignment): void {
		const plugin = this.marketplaceQuery.plugin;
		if (!plugin) return;

		this.actions.dispatch(
			PluginUserAssignmentActions.unassignUser({
				pluginId: plugin.id,
				installationId: assignment.pluginInstallationId,
				userId: assignment.userId
			})
		);
	}

	trackByAssignmentId(index: number, assignment: PluginUserAssignment): string {
		return assignment.id;
	}
}

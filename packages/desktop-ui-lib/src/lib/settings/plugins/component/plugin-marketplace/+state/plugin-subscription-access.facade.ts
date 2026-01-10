// Plugin Subscription Access Facade
// Provides a high-level API for components to interact with subscription access state

import { Injectable } from '@angular/core';
import { PluginScope } from '@gauzy/contracts';
import { Actions } from '@ngneat/effects-ng';
import { Observable } from 'rxjs';
import {
	IAssignPluginSubscription,
	IRevokePluginSubscriptionAssignment
} from '../../../services/plugin-subscription-access.service';
import { PluginSubscriptionAccessActions } from './actions/plugin-subscription-access.actions';
import { PluginSubscriptionAccessQuery } from './queries/plugin-subscription-access.query';
import { IPluginAccessState } from './stores/plugin-subscription-access.store';

/**
 * Facade service for plugin subscription access management
 * Provides a simplified API for components to:
 * - Check plugin access
 * - Assign/revoke users
 * - Manage UI state
 * - Query access information
 */
@Injectable({ providedIn: 'root' })
export class PluginSubscriptionAccessFacade {
	// ============================================================================
	// Observable Queries (for template binding)
	// ============================================================================

	/** Observable of loading state */
	loading$ = this.query.isLoading$();

	/** Observable of error state */
	error$ = this.query.getError$();

	/** Observable of selected plugin ID */
	selectedPluginId$ = this.query.getSelectedPluginId$();

	/** Observable of assignment dialog state */
	assignmentDialogOpen$ = this.query.isAssignmentDialogOpen$();

	/** Observable of revocation dialog state */
	revocationDialogOpen$ = this.query.isRevocationDialogOpen$();

	/** Observable of selected user IDs */
	selectedUserIds$ = this.query.getSelectedUserIds$();

	/** Observable of bulk check progress */
	bulkCheckInProgress$ = this.query.isBulkCheckInProgress$();

	constructor(private readonly actions: Actions, private readonly query: PluginSubscriptionAccessQuery) {}

	// ============================================================================
	// Access Check Methods
	// ============================================================================

	/**
	 * Check if current user has access to a plugin
	 * @param pluginId Plugin ID
	 */
	checkAccess(pluginId: string): void {
		this.actions.dispatch(PluginSubscriptionAccessActions.checkAccess(pluginId));
	}

	/**
	 * Check if a specific user has access to a plugin
	 * @param pluginId Plugin ID
	 * @param userId User ID
	 */
	checkUserAccess(pluginId: string, userId: string): void {
		this.actions.dispatch(PluginSubscriptionAccessActions.checkUserAccess(pluginId, userId));
	}

	/**
	 * Check access for multiple plugins at once
	 * @param pluginIds Array of plugin IDs
	 */
	bulkCheckAccess(pluginIds: string[]): void {
		this.actions.dispatch(PluginSubscriptionAccessActions.bulkCheckAccess(pluginIds));
	}

	/**
	 * Refresh plugin access data
	 * @param pluginId Plugin ID
	 */
	refreshPluginAccess(pluginId: string): void {
		this.actions.dispatch(PluginSubscriptionAccessActions.refreshPluginAccess(pluginId));
	}

	// ============================================================================
	// User Assignment Methods
	// ============================================================================

	/**
	 * Assign users to a plugin subscription
	 * Creates child USER-scoped subscriptions
	 * @param pluginId Plugin ID
	 * @param userIds Array of user IDs to assign
	 * @param reason Optional reason for assignment
	 */
	assignUsers(pluginId: string, userIds: string[], reason?: string): void {
		const dto: IAssignPluginSubscription = {
			userIds,
			reason
		};
		this.actions.dispatch(PluginSubscriptionAccessActions.assignUsers(pluginId, dto));
	}

	/**
	 * Revoke users from a plugin subscription
	 * Cancels child subscriptions and removes access
	 * @param pluginId Plugin ID
	 * @param userIds Array of user IDs to revoke
	 * @param revocationReason Reason for revocation
	 */
	revokeUsers(pluginId: string, userIds: string[], revocationReason: string): void {
		const dto: IRevokePluginSubscriptionAssignment = {
			userIds,
			revocationReason
		};
		this.actions.dispatch(PluginSubscriptionAccessActions.revokeUsers(pluginId, dto));
	}

	// ============================================================================
	// UI State Methods
	// ============================================================================

	/**
	 * Show assignment dialog for a plugin
	 * @param pluginId Plugin ID
	 */
	showAssignmentDialog(pluginId: string): void {
		this.actions.dispatch(PluginSubscriptionAccessActions.showAssignmentDialog(pluginId));
	}

	/**
	 * Hide assignment dialog
	 */
	hideAssignmentDialog(): void {
		this.actions.dispatch(PluginSubscriptionAccessActions.hideAssignmentDialog());
	}

	/**
	 * Show revocation dialog for specific users
	 * @param pluginId Plugin ID
	 * @param userIds Array of user IDs to revoke
	 */
	showRevocationDialog(pluginId: string, userIds: string[]): void {
		this.actions.dispatch(PluginSubscriptionAccessActions.showRevocationDialog(pluginId, userIds));
	}

	/**
	 * Hide revocation dialog
	 */
	hideRevocationDialog(): void {
		this.actions.dispatch(PluginSubscriptionAccessActions.hideRevocationDialog());
	}

	/**
	 * Select plugin for access management
	 * @param pluginId Plugin ID or null to deselect
	 */
	selectPluginForAccess(pluginId: string | null): void {
		this.actions.dispatch(PluginSubscriptionAccessActions.selectPluginForAccess(pluginId));
	}

	/**
	 * Reset error state
	 */
	resetError(): void {
		this.actions.dispatch(PluginSubscriptionAccessActions.resetError());
	}

	/**
	 * Reset entire state
	 */
	resetState(): void {
		this.actions.dispatch(PluginSubscriptionAccessActions.resetState());
	}

	// ============================================================================
	// Cache Management Methods
	// ============================================================================

	/**
	 * Clear access cache for a specific plugin
	 * @param pluginId Plugin ID
	 */
	clearPluginAccessCache(pluginId: string): void {
		this.actions.dispatch(PluginSubscriptionAccessActions.clearPluginAccessCache(pluginId));
	}

	/**
	 * Clear all access cache
	 */
	clearAllAccessCache(): void {
		this.actions.dispatch(PluginSubscriptionAccessActions.clearAllAccessCache());
	}

	// ============================================================================
	// Query Methods (Observable)
	// ============================================================================

	/**
	 * Get plugin access state as observable
	 * @param pluginId Plugin ID
	 * @returns Observable of plugin access state
	 */
	getPluginAccess$(pluginId: string): Observable<IPluginAccessState | undefined> {
		return this.query.getPluginAccess$(pluginId);
	}

	/**
	 * Check if user has access to plugin (observable)
	 * @param pluginId Plugin ID
	 * @returns Observable of boolean
	 */
	hasAccess$(pluginId: string): Observable<boolean> {
		return this.query.hasAccess$(pluginId);
	}

	/**
	 * Check if user can assign subscriptions (observable)
	 * @param pluginId Plugin ID
	 * @returns Observable of boolean
	 */
	canAssign$(pluginId: string): Observable<boolean> {
		return this.query.canAssign$(pluginId);
	}

	/**
	 * Check if user can configure the plugin (observable)
	 * @param pluginId Plugin ID
	 * @returns Observable of boolean
	 */
	canConfig$(pluginId: string): Observable<boolean> {
		return this.query.canConfig$(pluginId);
	}

	/**
	 * Get access level for plugin (observable)
	 * @param pluginId Plugin ID
	 * @returns Observable of PluginScope or undefined
	 */
	getAccessLevel$(pluginId: string): Observable<PluginScope | undefined> {
		return this.query.getAccessLevel$(pluginId);
	}

	/**
	 * Check if plugin requires subscription (observable)
	 * @param pluginId Plugin ID
	 * @returns Observable of boolean
	 */
	requiresSubscription$(pluginId: string): Observable<boolean> {
		return this.query.requiresSubscription$(pluginId);
	}

	/**
	 * Get all plugins with access (observable)
	 * @returns Observable of array of plugin access states
	 */
	getPluginsWithAccess$(): Observable<IPluginAccessState[]> {
		return this.query.getPluginsWithAccess$();
	}

	/**
	 * Get all plugins where user can assign (observable)
	 * @returns Observable of array of plugin access states
	 */
	getPluginsWithAssignPermission$(): Observable<IPluginAccessState[]> {
		return this.query.getPluginsWithAssignPermission$();
	}

	/**
	 * Check if specific user has access (observable)
	 * @param pluginId Plugin ID
	 * @param userId User ID
	 * @returns Observable of boolean
	 */
	doesUserHaveAccess$(pluginId: string, userId: string): Observable<boolean> {
		return this.query.doesUserHaveAccess$(pluginId, userId);
	}

	// ============================================================================
	// Query Methods (Synchronous)
	// ============================================================================

	/**
	 * Get plugin access state synchronously
	 * @param pluginId Plugin ID
	 * @returns Plugin access state or undefined
	 */
	getPluginAccess(pluginId: string): IPluginAccessState | undefined {
		return this.query.getPluginAccess(pluginId);
	}

	/**
	 * Check if user has access to plugin (sync)
	 * @param pluginId Plugin ID
	 * @returns boolean
	 */
	hasAccess(pluginId: string): boolean {
		return this.query.hasAccess(pluginId);
	}

	/**
	 * Check if user can assign subscriptions (sync)
	 * @param pluginId Plugin ID
	 * @returns boolean
	 */
	canAssign(pluginId: string): boolean {
		return this.query.canAssign(pluginId);
	}

	/**
	 * Get access level for plugin (sync)
	 * @param pluginId Plugin ID
	 * @returns PluginScope or undefined
	 */
	getAccessLevel(pluginId: string): PluginScope | undefined {
		return this.query.getAccessLevel(pluginId);
	}

	/**
	 * Check if plugin requires subscription (sync)
	 * @param pluginId Plugin ID
	 * @returns boolean
	 */
	requiresSubscription(pluginId: string): boolean {
		return this.query.requiresSubscription(pluginId);
	}

	/**
	 * Get selected plugin ID (sync)
	 * @returns Plugin ID or null
	 */
	getSelectedPluginId(): string | null {
		return this.query.getSelectedPluginId();
	}

	/**
	 * Check if assignment dialog is open (sync)
	 * @returns boolean
	 */
	isAssignmentDialogOpen(): boolean {
		return this.query.isAssignmentDialogOpen();
	}

	/**
	 * Check if revocation dialog is open (sync)
	 * @returns boolean
	 */
	isRevocationDialogOpen(): boolean {
		return this.query.isRevocationDialogOpen();
	}

	/**
	 * Get loading state (sync)
	 * @returns boolean
	 */
	isLoading(): boolean {
		return this.query.isLoading();
	}

	/**
	 * Get error state (sync)
	 * @returns Error message or null
	 */
	getError(): string | null {
		return this.query.getError();
	}
}

// Plugin Subscription Access Query
// Provides query methods for subscription access state

import { Injectable } from '@angular/core';
import { QueryEntity } from '@datorama/akita';
import { PluginScope } from '@gauzy/contracts';
import { Observable, map } from 'rxjs';
import {
	IPluginAccessState,
	IPluginSubscriptionAccessEntityState,
	IUserAccessCheck,
	PluginSubscriptionAccessStore
} from '../stores/plugin-subscription-access.store';

@Injectable({ providedIn: 'root' })
export class PluginSubscriptionAccessQuery extends QueryEntity<
	IPluginSubscriptionAccessEntityState,
	IPluginAccessState
> {
	constructor(protected override store: PluginSubscriptionAccessStore) {
		super(store);
	}

	// ============================================================================
	// Plugin Access Queries
	// ============================================================================

	/**
	 * Get plugin access state
	 */
	getPluginAccess$(pluginId: string): Observable<IPluginAccessState | undefined> {
		return this.selectEntity(pluginId);
	}

	/**
	 * Check if user has access to plugin
	 */
	hasAccess$(pluginId: string): Observable<boolean> {
		return this.selectEntity(pluginId).pipe(map((state) => state?.hasAccess || false));
	}

	/**
	 * Check if user can assign subscriptions
	 */
	canAssign$(pluginId: string): Observable<boolean> {
		return this.selectEntity(pluginId).pipe(map((state) => state?.canAssign || false));
	}

	/**
	 * Check if user can configure plugin
	 */
	canConfig$(pluginId: string): Observable<boolean> {
		return this.selectEntity(pluginId).pipe(map((state) => state?.accessLevel !== PluginScope.USER || false));
	}

	/**
	 * Get access level for plugin
	 */
	getAccessLevel$(pluginId: string): Observable<PluginScope | undefined> {
		return this.selectEntity(pluginId).pipe(map((state) => state?.accessLevel));
	}

	/**
	 * Check if plugin requires subscription
	 */
	requiresSubscription$(pluginId: string): Observable<boolean> {
		return this.selectEntity(pluginId).pipe(map((state) => state?.requiresSubscription ?? true));
	}

	/**
	 * Get all plugins with access
	 */
	getPluginsWithAccess$(): Observable<IPluginAccessState[]> {
		return this.selectAll({
			filterBy: (state) => state.hasAccess
		});
	}

	/**
	 * Get all plugins where user can assign
	 */
	getPluginsWithAssignPermission$(): Observable<IPluginAccessState[]> {
		return this.selectAll({
			filterBy: (state) => state.canAssign
		});
	}

	/**
	 * Get loading state for specific plugin
	 */
	isPluginAccessLoading$(pluginId: string): Observable<boolean> {
		return this.selectEntity(pluginId).pipe(map((state) => state?.loading || false));
	}

	/**
	 * Get error state for specific plugin
	 */
	getPluginAccessError$(pluginId: string): Observable<string | undefined> {
		return this.selectEntity(pluginId).pipe(map((state) => state?.error));
	}

	// ============================================================================
	// User Access Check Queries
	// ============================================================================

	/**
	 * Get user access check
	 */
	getUserAccessCheck$(pluginId: string, userId: string): Observable<IUserAccessCheck | undefined> {
		const id = `${pluginId}:${userId}`;
		return this.select((state) => state.userAccessChecks[id]);
	}

	/**
	 * Get all user access checks for a plugin
	 */
	getPluginUserAccessChecks$(pluginId: string): Observable<IUserAccessCheck[]> {
		return this.select((state) => {
			const checks: IUserAccessCheck[] = [];
			Object.values(state.userAccessChecks).forEach((check) => {
				if (check.pluginId === pluginId) {
					checks.push(check);
				}
			});
			return checks;
		});
	}

	/**
	 * Check if specific user has access
	 */
	doesUserHaveAccess$(pluginId: string, userId: string): Observable<boolean> {
		return this.getUserAccessCheck$(pluginId, userId).pipe(map((check) => check?.hasAccess || false));
	}

	// ============================================================================
	// UI State Queries
	// ============================================================================

	/**
	 * Get selected plugin ID
	 */
	getSelectedPluginId$(): Observable<string | null> {
		return this.select((state) => state.selectedPluginId);
	}

	/**
	 * Check if assignment dialog is open
	 */
	isAssignmentDialogOpen$(): Observable<boolean> {
		return this.select((state) => state.assignmentDialogOpen);
	}

	/**
	 * Check if revocation dialog is open
	 */
	isRevocationDialogOpen$(): Observable<boolean> {
		return this.select((state) => state.revocationDialogOpen);
	}

	/**
	 * Get selected user IDs
	 */
	getSelectedUserIds$(): Observable<string[]> {
		return this.select((state) => state.selectedUserIds);
	}

	/**
	 * Get loading state
	 */
	isLoading$(): Observable<boolean> {
		return this.select((state) => state.loading);
	}

	/**
	 * Get error state
	 */
	getError$(): Observable<string | null> {
		return this.select((state) => state.error);
	}

	/**
	 * Check if bulk check is in progress
	 */
	isBulkCheckInProgress$(): Observable<boolean> {
		return this.select((state) => state.bulkCheckInProgress);
	}

	/**
	 * Get last bulk check date
	 */
	getLastBulkCheck$(): Observable<Date | undefined> {
		return this.select((state) => state.lastBulkCheck);
	}

	/**
	 * Get current operation
	 */
	getCurrentOperation$(): Observable<any> {
		return this.select((state) => state.currentOperation);
	}

	// ============================================================================
	// Synchronous Getters
	// ============================================================================

	/**
	 * Get plugin access state synchronously
	 */
	getPluginAccess(pluginId: string): IPluginAccessState | undefined {
		return this.getEntity(pluginId);
	}

	/**
	 * Check if user has access synchronously
	 */
	hasAccess(pluginId: string): boolean {
		return this.getEntity(pluginId)?.hasAccess || false;
	}

	/**
	 * Check if user can assign synchronously
	 */
	canAssign(pluginId: string): boolean {
		return this.getEntity(pluginId)?.canAssign || false;
	}

	/**
	 * Get access level synchronously
	 */
	getAccessLevel(pluginId: string): PluginScope | undefined {
		return this.getEntity(pluginId)?.accessLevel;
	}

	/**
	 * Check if plugin requires subscription synchronously
	 */
	requiresSubscription(pluginId: string): boolean {
		return this.getEntity(pluginId)?.requiresSubscription ?? true;
	}

	/**
	 * Get selected plugin ID synchronously
	 */
	getSelectedPluginId(): string | null {
		return this.getValue().selectedPluginId;
	}

	/**
	 * Check if assignment dialog is open synchronously
	 */
	isAssignmentDialogOpen(): boolean {
		return this.getValue().assignmentDialogOpen;
	}

	/**
	 * Check if revocation dialog is open synchronously
	 */
	isRevocationDialogOpen(): boolean {
		return this.getValue().revocationDialogOpen;
	}

	/**
	 * Get loading state synchronously
	 */
	isLoading(): boolean {
		return this.getValue().loading;
	}

	/**
	 * Get error state synchronously
	 */
	getError(): string | null {
		return this.getValue().error;
	}
}

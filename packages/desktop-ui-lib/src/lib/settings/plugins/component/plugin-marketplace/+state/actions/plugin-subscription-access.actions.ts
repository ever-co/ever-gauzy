// Plugin Subscription Access Actions for @ngneat/effects
// Handles access checking, user assignment, and revocation

import { createAction } from '@ngneat/effects';
import {
	IAssignPluginSubscription,
	IPluginSubscriptionAccessResponse,
	IRevokePluginSubscriptionAssignment
} from '../../../../services/plugin-subscription-access.service';

export class PluginSubscriptionAccessActions {
	// ============================================================================
	// Check Access Actions (Query)
	// ============================================================================

	/**
	 * Check if current user has access to a plugin
	 * Maps to: GetSubscriptionAccessQuery
	 */
	public static checkAccess = createAction('[Plugin Subscription Access] Check Access', (pluginId: string) => ({
		pluginId
	}));

	public static checkAccessSuccess = createAction(
		'[Plugin Subscription Access] Check Access Success',
		(response: IPluginSubscriptionAccessResponse) => ({ response })
	);

	public static checkAccessFailure = createAction(
		'[Plugin Subscription Access] Check Access Failure',
		(error: string) => ({ error })
	);

	// ============================================================================
	// Check User Access Actions (Query)
	// ============================================================================

	/**
	 * Check if a specific user has access to a plugin
	 * Maps to: CheckUserSubscriptionAccessQuery
	 */
	public static checkUserAccess = createAction(
		'[Plugin Subscription Access] Check User Access',
		(pluginId: string, userId: string) => ({ pluginId, userId })
	);

	public static checkUserAccessSuccess = createAction(
		'[Plugin Subscription Access] Check User Access Success',
		(userId: string, response: IPluginSubscriptionAccessResponse) => ({ userId, response })
	);

	public static checkUserAccessFailure = createAction(
		'[Plugin Subscription Access] Check User Access Failure',
		(error: string) => ({ error })
	);

	// ============================================================================
	// Assign Users Actions (Command)
	// ============================================================================

	/**
	 * Assign users to a plugin subscription
	 * Creates child USER-scoped subscriptions
	 * Maps to: AssignPluginSubscriptionUsersCommand
	 */
	public static assignUsers = createAction(
		'[Plugin Subscription Access] Assign Users',
		(pluginId: string, dto: IAssignPluginSubscription) => ({ pluginId, dto })
	);

	public static assignUsersSuccess = createAction(
		'[Plugin Subscription Access] Assign Users Success',
		(message: string, assignedUsers: number) => ({ message, assignedUsers })
	);

	public static assignUsersFailure = createAction(
		'[Plugin Subscription Access] Assign Users Failure',
		(error: string) => ({ error })
	);

	// ============================================================================
	// Revoke Users Actions (Command)
	// ============================================================================

	/**
	 * Revoke users from a plugin subscription
	 * Cancels child subscriptions and removes assignments
	 * Maps to: RevokePluginSubscriptionUsersCommand
	 */
	public static revokeUsers = createAction(
		'[Plugin Subscription Access] Revoke Users',
		(pluginId: string, dto: IRevokePluginSubscriptionAssignment) => ({ pluginId, dto })
	);

	public static revokeUsersSuccess = createAction(
		'[Plugin Subscription Access] Revoke Users Success',
		(message: string, revokedUsers: number) => ({ message, revokedUsers })
	);

	public static revokeUsersFailure = createAction(
		'[Plugin Subscription Access] Revoke Users Failure',
		(error: string) => ({ error })
	);

	// ============================================================================
	// Bulk Check Access Actions
	// ============================================================================

	/**
	 * Check access for multiple plugins at once
	 * Useful for plugin list views
	 */
	public static bulkCheckAccess = createAction(
		'[Plugin Subscription Access] Bulk Check Access',
		(pluginIds: string[]) => ({ pluginIds })
	);

	public static bulkCheckAccessSuccess = createAction(
		'[Plugin Subscription Access] Bulk Check Access Success',
		(accessMap: Map<string, IPluginSubscriptionAccessResponse>) => ({ accessMap })
	);

	public static bulkCheckAccessFailure = createAction(
		'[Plugin Subscription Access] Bulk Check Access Failure',
		(error: string) => ({ error })
	);

	// ============================================================================
	// UI State Actions
	// ============================================================================

	/**
	 * Show assignment dialog
	 */
	public static showAssignmentDialog = createAction(
		'[Plugin Subscription Access] Show Assignment Dialog',
		(pluginId: string) => ({ pluginId })
	);

	/**
	 * Hide assignment dialog
	 */
	public static hideAssignmentDialog = createAction('[Plugin Subscription Access] Hide Assignment Dialog');

	/**
	 * Show revocation dialog
	 */
	public static showRevocationDialog = createAction(
		'[Plugin Subscription Access] Show Revocation Dialog',
		(pluginId: string, userIds: string[]) => ({ pluginId, userIds })
	);

	/**
	 * Hide revocation dialog
	 */
	public static hideRevocationDialog = createAction('[Plugin Subscription Access] Hide Revocation Dialog');

	/**
	 * Select plugin for access management
	 */
	public static selectPluginForAccess = createAction(
		'[Plugin Subscription Access] Select Plugin',
		(pluginId: string | null) => ({ pluginId })
	);

	/**
	 * Reset error state
	 */
	public static resetError = createAction('[Plugin Subscription Access] Reset Error');

	/**
	 * Reset entire state
	 */
	public static resetState = createAction('[Plugin Subscription Access] Reset State');

	// ============================================================================
	// Cache Management Actions
	// ============================================================================

	/**
	 * Clear access cache for a plugin
	 */
	public static clearPluginAccessCache = createAction(
		'[Plugin Subscription Access] Clear Plugin Access Cache',
		(pluginId: string) => ({ pluginId })
	);

	/**
	 * Clear all access cache
	 */
	public static clearAllAccessCache = createAction('[Plugin Subscription Access] Clear All Access Cache');

	/**
	 * Refresh access data for a plugin
	 */
	public static refreshPluginAccess = createAction(
		'[Plugin Subscription Access] Refresh Plugin Access',
		(pluginId: string) => ({ pluginId })
	);
}

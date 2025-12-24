import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPluginSubscription, PluginScope, PluginSubscriptionStatus } from '@gauzy/contracts';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { Observable } from 'rxjs';

/**
 * Subscription access response DTO
 * Returned by access check endpoints
 */
export interface IPluginSubscriptionAccessResponse {
	hasAccess: boolean;
	accessLevel?: PluginScope;
	canAssign?: boolean;
	requiresSubscription: boolean;
	subscription?: IPluginSubscription;
}

/**
 * Check user access DTO
 * Used to check if a specific user has access to a plugin
 */
export interface ICheckPluginSubscriptionAccess {
	userId: string;
}

/**
 * Assign users DTO
 * Used to assign users to a plugin subscription
 */
export interface IAssignPluginSubscription {
	userIds: string[];
	reason?: string;
}

/**
 * Revoke users DTO
 * Used to revoke users from a plugin subscription
 */
export interface IRevokePluginSubscriptionAssignment {
	userIds: string[];
	revocationReason: string;
}

/**
 * Assignment/Revocation response DTO
 */
export interface IPluginSubscriptionAssignmentResponse {
	message: string;
	assignedUsers?: number;
	revokedUsers?: number;
}

/**
 * Service for managing plugin subscription access
 * Handles permission checks, user assignments, and access validation
 *
 * This service integrates with the CQRS backend implementation for:
 * - Checking subscription access (queries)
 * - Assigning users to subscriptions (commands)
 * - Revoking user access (commands)
 */
@Injectable({
	providedIn: 'root'
})
export class PluginSubscriptionAccessService {
	private readonly baseEndpoint = `${API_PREFIX}/plugins`;

	constructor(private readonly http: HttpClient) {}

	/**
	 * Check if current user has access to a plugin
	 *
	 * @param pluginId Plugin ID to check access for
	 * @returns Observable with access details
	 *
	 * Backend: GetSubscriptionAccessQuery
	 * Endpoint: GET /plugins/:pluginId/subscription/access
	 */
	public checkAccess(pluginId: string): Observable<IPluginSubscriptionAccessResponse> {
		return this.http.get<IPluginSubscriptionAccessResponse>(`${this.baseEndpoint}/${pluginId}/subscription/access`);
	}

	/**
	 * Check if a specific user has access to a plugin
	 *
	 * @param pluginId Plugin ID to check
	 * @param userId User ID to check access for
	 * @returns Observable with access details
	 *
	 * Backend: CheckUserSubscriptionAccessQuery
	 * Endpoint: POST /plugins/:pluginId/subscription/access/check
	 */
	public checkUserAccess(pluginId: string, userId: string): Observable<IPluginSubscriptionAccessResponse> {
		return this.http.post<IPluginSubscriptionAccessResponse>(
			`${this.baseEndpoint}/${pluginId}/subscription/access/check`,
			{ userId }
		);
	}

	/**
	 * Assign users to a plugin subscription
	 * Creates child USER-scoped subscriptions from parent org/tenant subscription
	 *
	 * @param pluginId Plugin ID
	 * @param dto Assignment details (userIds, reason)
	 * @returns Observable with assignment result
	 *
	 * Backend: AssignPluginSubscriptionUsersCommand
	 * Endpoint: POST /plugins/:pluginId/subscription/access/assign
	 *
	 * Process:
	 * 1. Validates requesting user has permission to assign
	 * 2. Finds parent subscription (org/tenant level)
	 * 3. Creates child USER-scoped subscriptions with parentId link
	 * 4. Creates user assignments in plugin_user_assignments table
	 */
	public assignUsers(
		pluginId: string,
		dto: IAssignPluginSubscription
	): Observable<IPluginSubscriptionAssignmentResponse> {
		return this.http.post<IPluginSubscriptionAssignmentResponse>(
			`${this.baseEndpoint}/${pluginId}/subscription/access/assign`,
			dto
		);
	}

	/**
	 * Revoke users from a plugin subscription
	 * Cancels child USER-scoped subscriptions and removes assignments
	 *
	 * @param pluginId Plugin ID
	 * @param dto Revocation details (userIds, reason)
	 * @returns Observable with revocation result
	 *
	 * Backend: RevokePluginSubscriptionUsersCommand
	 * Endpoint: POST /plugins/:pluginId/subscription/access/revoke
	 *
	 * Process:
	 * 1. Validates requesting user has permission to revoke
	 * 2. Finds parent subscription
	 * 3. Updates child subscriptions to CANCELLED status
	 * 4. Removes user assignments
	 */
	public revokeUsers(
		pluginId: string,
		dto: IRevokePluginSubscriptionAssignment
	): Observable<IPluginSubscriptionAssignmentResponse> {
		return this.http.post<IPluginSubscriptionAssignmentResponse>(
			`${this.baseEndpoint}/${pluginId}/subscription/access/revoke`,
			dto
		);
	}

	/**
	 * Check if user can assign subscriptions
	 * Helper method that extracts canAssign from access check
	 *
	 * @param pluginId Plugin ID
	 * @returns Observable<boolean>
	 */
	public canAssignSubscriptions(pluginId: string): Observable<boolean> {
		return new Observable<boolean>((observer) => {
			this.checkAccess(pluginId).subscribe({
				next: (response) => {
					observer.next(response.canAssign || false);
					observer.complete();
				},
				error: (error) => observer.error(error)
			});
		});
	}

	/**
	 * Check if user has active subscription
	 * Helper method that checks hasAccess from access check
	 *
	 * @param pluginId Plugin ID
	 * @returns Observable<boolean>
	 */
	public hasActiveSubscription(pluginId: string): Observable<boolean> {
		return new Observable<boolean>((observer) => {
			this.checkAccess(pluginId).subscribe({
				next: (response) => {
					observer.next(response.hasAccess);
					observer.complete();
				},
				error: (error) => observer.error(error)
			});
		});
	}

	/**
	 * Get subscription access level
	 * Returns the scope at which user has access (USER, ORG, TENANT)
	 *
	 * @param pluginId Plugin ID
	 * @returns Observable<PluginScope | null>
	 */
	public getAccessLevel(pluginId: string): Observable<PluginScope | null> {
		return new Observable<PluginScope | null>((observer) => {
			this.checkAccess(pluginId).subscribe({
				next: (response) => {
					observer.next(response.accessLevel || null);
					observer.complete();
				},
				error: (error) => observer.error(error)
			});
		});
	}

	/**
	 * Bulk check access for multiple plugins
	 * Useful for displaying plugin lists with access indicators
	 *
	 * @param pluginIds Array of plugin IDs
	 * @returns Observable<Map<string, IPluginSubscriptionAccessResponse>>
	 */
	public bulkCheckAccess(pluginIds: string[]): Observable<Map<string, IPluginSubscriptionAccessResponse>> {
		return new Observable<Map<string, IPluginSubscriptionAccessResponse>>((observer) => {
			const accessMap = new Map<string, IPluginSubscriptionAccessResponse>();
			let completed = 0;

			pluginIds.forEach((pluginId) => {
				this.checkAccess(pluginId).subscribe({
					next: (response) => {
						accessMap.set(pluginId, response);
						completed++;
						if (completed === pluginIds.length) {
							observer.next(accessMap);
							observer.complete();
						}
					},
					error: (error) => {
						// Store error as no access
						accessMap.set(pluginId, {
							hasAccess: false,
							requiresSubscription: true
						});
						completed++;
						if (completed === pluginIds.length) {
							observer.next(accessMap);
							observer.complete();
						}
					}
				});
			});
		});
	}

	/**
	 * Get access badge information for UI display
	 * Returns color and text based on access status
	 *
	 * @param hasAccess Whether user has access
	 * @param accessLevel The scope level of access
	 * @returns UI badge information
	 */
	public getAccessBadge(
		hasAccess: boolean,
		accessLevel?: PluginScope
	): {
		text: string;
		color: string;
		icon: string;
	} {
		if (!hasAccess) {
			return {
				text: 'No Access',
				color: 'danger',
				icon: 'lock-closed-outline'
			};
		}

		const levelBadges = {
			[PluginScope.USER]: {
				text: 'User Access',
				color: 'info',
				icon: 'person-outline'
			},
			[PluginScope.ORGANIZATION]: {
				text: 'Organization Access',
				color: 'success',
				icon: 'business-outline'
			},
			[PluginScope.TENANT]: {
				text: 'Tenant Access',
				color: 'primary',
				icon: 'globe-outline'
			}
		};

		return (
			(accessLevel && levelBadges[accessLevel]) || {
				text: 'Has Access',
				color: 'success',
				icon: 'checkmark-circle-outline'
			}
		);
	}

	/**
	 * Check if subscription requires payment
	 * Free plans don't require payment, paid plans do
	 *
	 * @param response Access check response
	 * @returns boolean
	 */
	public requiresPayment(response: IPluginSubscriptionAccessResponse): boolean {
		if (!response.subscription) {
			return response.requiresSubscription;
		}

		// If subscription exists and is active/trial, no payment needed
		const activeStatuses = [
			PluginSubscriptionStatus.ACTIVE,
			PluginSubscriptionStatus.TRIAL,
			PluginSubscriptionStatus.PENDING
		];
		return !activeStatuses.includes(response.subscription.status);
	}

	/**
	 * Format access level for display
	 *
	 * @param scope Plugin scope
	 * @returns Formatted string
	 */
	public formatAccessLevel(scope: PluginScope): string {
		const scopeMap = {
			[PluginScope.USER]: 'User',
			[PluginScope.ORGANIZATION]: 'Organization',
			[PluginScope.TENANT]: 'Tenant'
		};

		return scopeMap[scope] || scope;
	}
}

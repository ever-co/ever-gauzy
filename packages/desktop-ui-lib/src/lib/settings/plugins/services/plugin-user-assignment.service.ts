import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ID, IPagination, IUser } from '@gauzy/contracts';
import { Observable } from 'rxjs';

export interface PluginUserAssignment {
	id: string;
	userId: string;
	pluginSubscriptionId: string;
	assignedAt: Date;
	assignedBy: string;
	isActive: boolean;
	reason?: string;
	user?: IUser;
}

export interface AssignPluginUsersDTO {
	userIds: string[];
	reason?: string;
}

export interface BulkPluginUserAssignmentDTO {
	pluginSubscriptionIds: string[];
	userIds: string[];
	reason?: string;
}

export interface PluginUserAssignmentQueryDTO {
	pluginId?: string;
	userId?: string;
	pluginSubscriptionId?: string;
	includeInactive?: boolean;
}

/**
 * Plugin tenant user with access type
 */
export interface PluginTenantUser {
	id: string;
	firstName?: string;
	lastName?: string;
	email?: string;
	imageUrl?: string;
	accessType: 'allowed' | 'denied';
	assignedAt?: Date;
}

/**
 * Response for getting plugin tenant users
 */
export interface PluginTenantUsersResponse {
	items: PluginTenantUser[];
	total: number;
}

/**
 * Response for managing plugin tenant users
 */
export interface ManagePluginTenantUsersResponse {
	pluginTenant: any;
	affectedUserIds: string[];
	operation: string;
	message: string;
}

@Injectable({
	providedIn: 'root'
})
export class PluginUserAssignmentService {
	constructor(private readonly http: HttpClient) {}

	/**
	 * Assign users to a plugin subscription
	 * Uses subscription-based access control endpoint
	 * @param pluginId - Plugin identifier
	 * @param userIds - Array of user IDs to assign
	 * @param reason - Optional reason for assignment
	 */
	assignUsers(
		pluginId: ID,
		userIds: string[],
		reason?: string
	): Observable<{ message: string; assignedUsers: number }> {
		return this.http.post<{ message: string; assignedUsers: number }>(
			`/api/plugins/${pluginId}/subscription/access/assign`,
			{ userIds, reason }
		);
	}

	/**
	 * Revoke plugin subscription from users
	 * Uses subscription-based access control endpoint
	 * @param pluginId - Plugin identifier
	 * @param userIds - Array of user IDs to revoke
	 * @param revocationReason - Reason for revocation
	 */
	revokeUsers(
		pluginId: ID,
		userIds: string[],
		revocationReason: string
	): Observable<{ message: string; revokedUsers: number }> {
		return this.http.post<{ message: string; revokedUsers: number }>(
			`/api/plugins/${pluginId}/subscription/access/revoke`,
			{ userIds, revocationReason }
		);
	}

	/**
	 * Get all user assignments for a plugin with pagination
	 * Backend: GET /plugins/:pluginId/users
	 */
	getPluginUserAssignments(
		pluginId: ID,
		includeInactive = false,
		take?: number,
		skip?: number
	): Observable<IPagination<PluginUserAssignment>> {
		let params = new HttpParams();
		if (includeInactive) {
			params = params.set('includeInactive', 'true');
		}
		if (take !== undefined) {
			params = params.set('take', take.toString());
		}
		if (skip !== undefined) {
			params = params.set('skip', skip.toString());
		}

		return this.http.get<IPagination<PluginUserAssignment>>(`/api/plugins/${pluginId}/users`, { params });
	}

	/**
	 * Get user assignment details including access status
	 * Backend: GET /users/:userId/plugins/:pluginId/access
	 */
	getUserAssignmentDetails(
		pluginId: ID,
		userId: ID
	): Observable<{ hasAccess: boolean; assignment?: PluginUserAssignment }> {
		return this.http.get<{ hasAccess: boolean; assignment?: PluginUserAssignment }>(
			`/api/users/${userId}/plugins/${pluginId}/access`
		);
	}

	/**
	 * Get all plugin assignments for a user with pagination
	 * Backend: GET /users/:userId/plugins
	 */
	getUserPluginAssignments(
		userId: ID,
		includeInactive = false,
		take?: number,
		skip?: number
	): Observable<IPagination<PluginUserAssignment>> {
		let params = new HttpParams();
		if (includeInactive) {
			params = params.set('includeInactive', 'true');
		}
		if (take !== undefined) {
			params = params.set('take', take.toString());
		}
		if (skip !== undefined) {
			params = params.set('skip', skip.toString());
		}

		return this.http.get<IPagination<PluginUserAssignment>>(`/api/users/${userId}/plugins`, { params });
	}

	/**
	 * Create multiple plugin user assignments in batch
	 */
	createBatch(bulkAssignDto: BulkPluginUserAssignmentDTO): Observable<PluginUserAssignment[]> {
		return this.http.post<PluginUserAssignment[]>('/api/plugin-user-assignments/batch', bulkAssignDto);
	}

	/**
	 * Get all plugin user assignments with optional filters and pagination
	 */
	getAllPluginUserAssignments(
		queryDto?: PluginUserAssignmentQueryDTO,
		take?: number,
		skip?: number
	): Observable<IPagination<PluginUserAssignment>> {
		let params = new HttpParams();

		if (queryDto) {
			if (queryDto.pluginId) {
				params = params.set('pluginId', queryDto.pluginId);
			}
			if (queryDto.userId) {
				params = params.set('userId', queryDto.userId);
			}
			if (queryDto.pluginSubscriptionId) {
				params = params.set('pluginSubscriptionId', queryDto.pluginSubscriptionId);
			}
			if (queryDto.includeInactive) {
				params = params.set('includeInactive', 'true');
			}
		}

		if (take !== undefined) {
			params = params.set('take', take.toString());
		}
		if (skip !== undefined) {
			params = params.set('skip', skip.toString());
		}

		return this.http.get<IPagination<PluginUserAssignment>>('/api/plugin-user-assignments', { params });
	}

	/**
	 * Check if current user has access to the plugin
	 * Uses subscription access check endpoint
	 * @param pluginId - Plugin identifier
	 */
	checkAccess(pluginId: ID): Observable<{
		hasAccess: boolean;
		accessLevel?: string;
		canAssign?: boolean;
		requiresSubscription?: boolean;
		subscription?: any;
	}> {
		return this.http.get<{
			hasAccess: boolean;
			accessLevel?: string;
			canAssign?: boolean;
			requiresSubscription?: boolean;
			subscription?: any;
		}>(`/api/plugins/${pluginId}/subscription/access`);
	}

	/**
	 * Check if a specific user has access to the plugin
	 * Uses subscription access check endpoint
	 * @param pluginId - Plugin identifier
	 * @param userId - User identifier
	 */
	checkUserAccess(
		pluginId: ID,
		userId: ID
	): Observable<{
		hasAccess: boolean;
		accessLevel?: string;
		canAssign?: boolean;
		requiresSubscription?: boolean;
		subscription?: any;
	}> {
		return this.http.post<{
			hasAccess: boolean;
			accessLevel?: string;
			canAssign?: boolean;
			requiresSubscription?: boolean;
			subscription?: any;
		}>(`/api/plugins/${pluginId}/subscription/access/check`, { userId });
	}

	/**
	 * Load next page of assignments (for infinite scroll)
	 * Backend: GET /plugins/:pluginId/users
	 */
	loadNextPage(
		pluginId: ID,
		take: number,
		skip: number,
		includeInactive = false
	): Observable<IPagination<PluginUserAssignment>> {
		return this.getPluginUserAssignments(pluginId, includeInactive, take, skip);
	}

	// ============================================================================
	// Plugin Tenant User Management
	// ============================================================================

	/**
	 * Get users for a plugin tenant (allowed, denied, or all)
	 * @param pluginTenantId - Plugin tenant identifier
	 * @param type - Type of users to retrieve: 'allowed', 'denied', or 'all'
	 * @param take - Number of records to take
	 * @param skip - Number of records to skip
	 * @param searchTerm - Optional search term
	 */
	getPluginTenantUsers(
		pluginTenantId: ID,
		type: 'allowed' | 'denied' | 'all' = 'all',
		take?: number,
		skip?: number,
		searchTerm?: string
	): Observable<PluginTenantUsersResponse> {
		let params = new HttpParams().set('type', type);
		if (take !== undefined) {
			params = params.set('take', take.toString());
		}
		if (skip !== undefined) {
			params = params.set('skip', skip.toString());
		}
		if (searchTerm) {
			params = params.set('searchTerm', searchTerm);
		}

		return this.http.get<PluginTenantUsersResponse>(`/api/plugin-tenants/${pluginTenantId}/users`, { params });
	}

	/**
	 * Allow users access to a plugin tenant
	 * @param pluginTenantId - Plugin tenant identifier
	 * @param userIds - Array of user IDs to allow
	 * @param reason - Optional reason for the operation
	 */
	allowUsersToPluginTenant(
		pluginTenantId: ID,
		userIds: string[],
		reason?: string
	): Observable<ManagePluginTenantUsersResponse> {
		return this.http.post<ManagePluginTenantUsersResponse>(`/api/plugin-tenants/${pluginTenantId}/users`, {
			userIds,
			operation: 'allow',
			reason
		});
	}

	/**
	 * Deny users access to a plugin tenant
	 * @param pluginTenantId - Plugin tenant identifier
	 * @param userIds - Array of user IDs to deny
	 * @param reason - Optional reason for the operation
	 */
	denyUsersFromPluginTenant(
		pluginTenantId: ID,
		userIds: string[],
		reason?: string
	): Observable<ManagePluginTenantUsersResponse> {
		return this.http.post<ManagePluginTenantUsersResponse>(`/api/plugin-tenants/${pluginTenantId}/users`, {
			userIds,
			operation: 'deny',
			reason
		});
	}

	/**
	 * Remove users from allowed list for a plugin tenant
	 * @param pluginTenantId - Plugin tenant identifier
	 * @param userIds - Array of user IDs to remove from allowed list
	 * @param reason - Optional reason for the operation
	 */
	removeAllowedUsersFromPluginTenant(
		pluginTenantId: ID,
		userIds: string[],
		reason?: string
	): Observable<ManagePluginTenantUsersResponse> {
		return this.http.post<ManagePluginTenantUsersResponse>(`/api/plugin-tenants/${pluginTenantId}/users`, {
			userIds,
			operation: 'remove-allowed',
			reason
		});
	}

	/**
	 * Remove users from denied list for a plugin tenant
	 * @param pluginTenantId - Plugin tenant identifier
	 * @param userIds - Array of user IDs to remove from denied list
	 * @param reason - Optional reason for the operation
	 */
	removeDeniedUsersFromPluginTenant(
		pluginTenantId: ID,
		userIds: string[],
		reason?: string
	): Observable<ManagePluginTenantUsersResponse> {
		return this.http.post<ManagePluginTenantUsersResponse>(`/api/plugin-tenants/${pluginTenantId}/users`, {
			userIds,
			operation: 'remove-denied',
			reason
		});
	}

	/**
	 * Get plugin tenant by plugin ID
	 * This will find or create the plugin tenant for the current tenant/organization
	 * @param pluginId - Plugin identifier
	 */
	getPluginTenantByPluginId(pluginId: ID): Observable<{ id: string; pluginId: string }> {
		return this.http.get<{ id: string; pluginId: string }>(`/api/plugins/${pluginId}/tenant`);
	}
}

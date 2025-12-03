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
}

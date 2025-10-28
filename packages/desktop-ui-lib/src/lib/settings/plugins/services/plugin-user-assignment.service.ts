import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ID } from '@gauzy/contracts';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface PluginUserAssignment {
	id: string;
	userId: string;
	pluginInstallationId: string;
	assignedAt: Date;
	assignedBy: string;
	isActive: boolean;
	reason?: string;
	user?: {
		id: string;
		firstName: string;
		lastName: string;
		email: string;
		imageUrl?: string;
	};
}

export interface AssignPluginUsersDTO {
	userIds: string[];
	reason?: string;
}

export interface BulkPluginUserAssignmentDTO {
	pluginInstallationIds: string[];
	userIds: string[];
	reason?: string;
}

export interface PluginUserAssignmentQueryDTO {
	pluginId?: string;
	userId?: string;
	pluginInstallationId?: string;
	includeInactive?: boolean;
}

@Injectable({
	providedIn: 'root'
})
export class PluginUserAssignmentService {
	constructor(private readonly http: HttpClient) {}

	/**
	 * Assign users to a plugin installation
	 */
	assignUsers(pluginId: ID, installationId: ID, assignDto: AssignPluginUsersDTO): Observable<PluginUserAssignment[]> {
		return this.http.post<PluginUserAssignment[]>(
			`/api/plugins/${pluginId}/installations/${installationId}/users`,
			assignDto
		);
	}

	/**
	 * Unassign a user from plugin installation
	 */
	unassignUser(pluginId: ID, installationId: ID, userId: ID): Observable<void> {
		return this.http.delete<void>(`/api/plugins/${pluginId}/installations/${installationId}/users/${userId}`);
	}

	/**
	 * Get all user assignments for a plugin installation
	 */
	getPluginUserAssignments(
		pluginId: ID,
		installationId: ID,
		includeInactive = false
	): Observable<PluginUserAssignment[]> {
		let params = new HttpParams();
		if (includeInactive) {
			params = params.set('includeInactive', 'true');
		}

		return this.http.get<PluginUserAssignment[]>(`/api/plugins/${pluginId}/installations/${installationId}/users`, {
			params
		});
	}

	/**
	 * Get user assignment details including access status
	 */
	getUserAssignmentDetails(
		pluginId: ID,
		installationId: ID,
		userId: ID
	): Observable<{ hasAccess: boolean; assignment?: PluginUserAssignment }> {
		return this.http.get<{ hasAccess: boolean; assignment?: PluginUserAssignment }>(
			`/api/plugins/${pluginId}/installations/${installationId}/users/${userId}`
		);
	}

	/**
	 * Get all plugin assignments for a user
	 */
	getUserPluginAssignments(userId: ID, includeInactive = false): Observable<PluginUserAssignment[]> {
		let params = new HttpParams();
		if (includeInactive) {
			params = params.set('includeInactive', 'true');
		}

		return this.http.get<PluginUserAssignment[]>(`/api/users/${userId}/plugin-assignments`, { params });
	}

	/**
	 * Create multiple plugin user assignments in batch
	 */
	createBatch(bulkAssignDto: BulkPluginUserAssignmentDTO): Observable<PluginUserAssignment[]> {
		return this.http.post<PluginUserAssignment[]>('/api/plugin-user-assignments/batch', bulkAssignDto);
	}

	/**
	 * Get all plugin user assignments with optional filters
	 */
	getAllPluginUserAssignments(queryDto?: PluginUserAssignmentQueryDTO): Observable<PluginUserAssignment[]> {
		let params = new HttpParams();

		if (queryDto) {
			if (queryDto.pluginId) {
				params = params.set('pluginId', queryDto.pluginId);
			}
			if (queryDto.userId) {
				params = params.set('userId', queryDto.userId);
			}
			if (queryDto.pluginInstallationId) {
				params = params.set('pluginInstallationId', queryDto.pluginInstallationId);
			}
			if (queryDto.includeInactive) {
				params = params.set('includeInactive', 'true');
			}
		}

		return this.http.get<PluginUserAssignment[]>('/api/plugin-user-assignments', { params });
	}

	/**
	 * Check if a user has access to a specific plugin installation
	 */
	checkUserAccess(pluginId: ID, installationId: ID, userId: ID): Observable<boolean> {
		return this.http
			.get<{ hasAccess: boolean }>(`/api/plugins/${pluginId}/installations/${installationId}/users/${userId}`)
			.pipe(map((response) => response.hasAccess));
	}
}

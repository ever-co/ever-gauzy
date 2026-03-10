import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { ID, IUser } from '@gauzy/contracts';

/**
 * Fine-grained operation loading flags.
 * Each flag maps to one class of mutation so components can show
 * per-row or per-button spinners without blocking the whole table.
 */
export interface PluginUserOperationState {
	/** True while an allow / enable API call is in-flight. */
	enabling: boolean;
	/** True while a deny / revoke API call is in-flight. */
	disabling: boolean;
	/** True while an unassign API call is in-flight. */
	unassigning: boolean;
	/** True while an assign (add) API call is in-flight. */
	assigning: boolean;
	/** True while a remove-from-allowed API call is in-flight. */
	removingAllowed: boolean;
	/** True while a remove-from-denied API call is in-flight. */
	removingDenied: boolean;
	/** True while a plugin-tenant enable/disable call is in-flight. */
	togglingTenant: boolean;
}

export interface PluginUserAssignmentState {
	assignments: PluginUserAssignment[];
	loading: boolean;
	loadingMore: boolean; // For infinite scroll loading state
	operations: PluginUserOperationState;
	error: string | null;
	selectedPluginId: string | null;
	selectedSubscriptionId: string | null;
	currentPluginTenantId: string | null; // Current plugin tenant ID for user operations
	// Pagination metadata using standard TypeORM naming
	pagination: {
		skip: number; // Offset (how many to skip)
		take: number; // Limit (how many to take)
		total: number;
		hasMore: boolean;
	};
}

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

export interface AssignPluginUsersRequest {
	pluginId: ID;
	subscriptionId?: ID;
	userIds: string[];
	reason?: string;
}

export interface UnassignPluginUserRequest {
	pluginId: ID;
	subscriptionId?: ID;
	userId: ID;
}

export interface GetPluginUserAssignmentsRequest {
	pluginId: ID;
	subscriptionId?: ID; // Optional: if not provided, returns all assignments for the plugin
	includeInactive?: boolean;
}

export interface BulkAssignPluginUsersRequest {
	pluginSubscriptionIds: string[];
	userIds: string[];
	reason?: string;
}

function createInitialOperationState(): PluginUserOperationState {
	return {
		enabling: false,
		disabling: false,
		unassigning: false,
		assigning: false,
		removingAllowed: false,
		removingDenied: false,
		togglingTenant: false
	};
}

function createInitialState(): PluginUserAssignmentState {
	return {
		assignments: [],
		loading: false,
		loadingMore: false,
		operations: createInitialOperationState(),
		error: null,
		selectedPluginId: null,
		selectedSubscriptionId: null,
		currentPluginTenantId: null,
		pagination: {
			skip: 0,
			take: 20,
			total: 0,
			hasMore: false
		}
	};
}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: '_plugin_user_assignments' })
export class PluginUserAssignmentStore extends Store<PluginUserAssignmentState> {
	constructor() {
		super(createInitialState());
	}

	setLoading(loading: boolean): void {
		this.update({ loading });
	}

	setLoadingMore(loadingMore: boolean): void {
		this.update({ loadingMore });
	}

	/**
	 * Patch one or more operation flags without touching any other state.
	 */
	setOperation(patch: Partial<PluginUserOperationState>): void {
		this.update((state) => ({ operations: { ...state.operations, ...patch } }));
	}

	/** Reset all operation flags to false (e.g., on error or after success). */
	clearOperations(): void {
		this.update({ operations: createInitialOperationState() });
	}

	setErrorMessage(error: string | null): void {
		this.update({ error });
	}

	setAssignments(assignments: PluginUserAssignment[], total?: number): void {
		const currentState = this.getValue();
		this.update({
			assignments,
			error: null,
			pagination: {
				...currentState.pagination,
				total: total !== undefined ? total : assignments.length,
				hasMore: total !== undefined ? assignments.length < total : false
			}
		});
	}

	appendAssignments(newAssignments: PluginUserAssignment[], total: number): void {
		const currentState = this.getValue();
		const currentAssignments = currentState.assignments;

		// Merge assignments, avoiding duplicates
		const mergedAssignments = [...currentAssignments];
		newAssignments.forEach((newAssignment) => {
			const existingIndex = mergedAssignments.findIndex((a) => a.id === newAssignment.id);
			if (existingIndex >= 0) {
				mergedAssignments[existingIndex] = newAssignment;
			} else {
				mergedAssignments.push(newAssignment);
			}
		});

		this.update({
			assignments: mergedAssignments,
			error: null,
			pagination: {
				...currentState.pagination,
				total,
				hasMore: mergedAssignments.length < total
			}
		});
	}

	addAssignments(newAssignments: PluginUserAssignment[]): void {
		const currentAssignments = this.getValue().assignments;
		const mergedAssignments = [...currentAssignments];

		newAssignments.forEach((newAssignment) => {
			const existingIndex = mergedAssignments.findIndex((a) => a.id === newAssignment.id);
			if (existingIndex >= 0) {
				mergedAssignments[existingIndex] = newAssignment;
			} else {
				mergedAssignments.push(newAssignment);
			}
		});

		this.update({ assignments: mergedAssignments, error: null });
	}

	removeAssignment(userId: string, subscriptionId: string): void {
		const assignments = this.getValue().assignments.filter(
			(a) => !(a.userId === userId && a.pluginSubscriptionId === subscriptionId)
		);
		this.update({ assignments });
	}

	/**
	 * Optimistically update isActive (or other fields) for a set of userIds.
	 * Used after allow/deny API calls to avoid a full server reload.
	 */
	updateAssignmentsByUserIds(userIds: string[], updates: Partial<PluginUserAssignment>): void {
		const assignments = this.getValue().assignments.map((assignment) =>
			userIds.includes(assignment.userId) ? { ...assignment, ...updates } : assignment
		);
		this.update({ assignments });
	}

	/**
	 * Optimistically remove a set of users by userId from the store.
	 * Used after unassign API calls to avoid a full server reload.
	 */
	removeAssignmentsByUserIds(userIds: string[]): void {
		const current = this.getValue();
		const assignments = current.assignments.filter((a) => !userIds.includes(a.userId));
		const removed = current.assignments.length - assignments.length;
		this.update({
			assignments,
			pagination: {
				...current.pagination,
				total: Math.max(0, current.pagination.total - removed)
			}
		});
	}

	updateAssignment(id: string, updates: Partial<PluginUserAssignment>): void {
		const assignments = this.getValue().assignments.map((assignment) =>
			assignment.id === id ? { ...assignment, ...updates } : assignment
		);
		this.update({ assignments });
	}

	selectPlugin(pluginId: string, subscriptionId?: string): void {
		this.update({ selectedPluginId: pluginId, selectedSubscriptionId: subscriptionId || null });
	}

	setCurrentPluginTenantId(pluginTenantId: string | null): void {
		this.update({ currentPluginTenantId: pluginTenantId });
	}

	clearSelection(): void {
		this.update({ selectedPluginId: null, selectedSubscriptionId: null });
	}

	clearAssignments(): void {
		this.update({
			assignments: [],
			pagination: {
				skip: 0,
				take: 20,
				total: 0,
				hasMore: false
			}
		});
	}

	clearError(): void {
		this.update({ error: null });
	}

	setSkip(skip: number): void {
		const currentState = this.getValue();
		this.update({
			pagination: {
				...currentState.pagination,
				skip
			}
		});
	}

	setTake(take: number): void {
		const currentState = this.getValue();
		this.update({
			pagination: {
				...currentState.pagination,
				take,
				skip: 0 // Reset to beginning when take size changes
			}
		});
	}

	incrementSkip(): void {
		const currentState = this.getValue();
		this.update({
			pagination: {
				...currentState.pagination,
				skip: currentState.pagination.skip + currentState.pagination.take
			}
		});
	}

	reset(): void {
		this.update(createInitialState());
	}
}

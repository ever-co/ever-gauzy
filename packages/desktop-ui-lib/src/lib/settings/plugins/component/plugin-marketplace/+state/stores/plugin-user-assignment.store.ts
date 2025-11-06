import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { ID, IUser } from '@gauzy/contracts';

export interface PluginUserAssignmentState {
	assignments: PluginUserAssignment[];
	loading: boolean;
	loadingMore: boolean; // For infinite scroll loading state
	error: string | null;
	selectedPluginId: string | null;
	selectedInstallationId: string | null;
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
	pluginInstallationId: string;
	assignedAt: Date;
	assignedBy: string;
	isActive: boolean;
	reason?: string;
	user?: IUser;
}

export interface AssignPluginUsersRequest {
	pluginId: ID;
	installationId: ID;
	userIds: string[];
	reason?: string;
}

export interface UnassignPluginUserRequest {
	pluginId: ID;
	installationId: ID;
	userId: ID;
}

export interface GetPluginUserAssignmentsRequest {
	pluginId: ID;
	installationId?: ID; // Optional: if not provided, returns all assignments for the plugin
	includeInactive?: boolean;
}

export interface BulkAssignPluginUsersRequest {
	pluginInstallationIds: string[];
	userIds: string[];
	reason?: string;
}

function createInitialState(): PluginUserAssignmentState {
	return {
		assignments: [],
		loading: false,
		loadingMore: false,
		error: null,
		selectedPluginId: null,
		selectedInstallationId: null,
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

	removeAssignment(userId: string, installationId: string): void {
		const assignments = this.getValue().assignments.filter(
			(a) => !(a.userId === userId && a.pluginInstallationId === installationId)
		);
		this.update({ assignments });
	}

	updateAssignment(id: string, updates: Partial<PluginUserAssignment>): void {
		const assignments = this.getValue().assignments.map((assignment) =>
			assignment.id === id ? { ...assignment, ...updates } : assignment
		);
		this.update({ assignments });
	}

	selectPlugin(pluginId: string, installationId: string): void {
		this.update({ selectedPluginId: pluginId, selectedInstallationId: installationId });
	}

	clearSelection(): void {
		this.update({ selectedPluginId: null, selectedInstallationId: null });
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

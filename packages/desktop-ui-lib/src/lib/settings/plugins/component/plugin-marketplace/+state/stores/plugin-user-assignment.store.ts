import { Injectable } from '@angular/core';
import { Store, StoreConfig } from '@datorama/akita';
import { ID } from '@gauzy/contracts';

export interface PluginUserAssignmentState {
	assignments: PluginUserAssignment[];
	loading: boolean;
	error: string | null;
	selectedPluginId: string | null;
	selectedInstallationId: string | null;
}

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
		error: null,
		selectedPluginId: null,
		selectedInstallationId: null
	};
}

@Injectable({ providedIn: 'root' })
@StoreConfig({ name: 'plugin-user-assignment' })
export class PluginUserAssignmentStore extends Store<PluginUserAssignmentState> {
	constructor() {
		super(createInitialState());
	}

	setLoading(loading: boolean): void {
		this.update({ loading });
	}

	setErrorMessage(error: string | null): void {
		this.update({ error });
	}

	setAssignments(assignments: PluginUserAssignment[]): void {
		this.update({ assignments, error: null });
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
		this.update({ assignments: [] });
	}

	clearError(): void {
		this.update({ error: null });
	}

	reset(): void {
		this.update(createInitialState());
	}
}

import { Injectable } from '@angular/core';
import { Query } from '@datorama/akita';
import { map, Observable } from 'rxjs';
import {
	PluginUserAssignment,
	PluginUserAssignmentState,
	PluginUserAssignmentStore
} from '../stores/plugin-user-assignment.store';

@Injectable({ providedIn: 'root' })
export class PluginUserAssignmentQuery extends Query<PluginUserAssignmentState> {
	constructor(protected store: PluginUserAssignmentStore) {
		super(store);
	}

	// State selectors
	assignments$ = this.select((state) => state.assignments);
	loading$ = this.select((state) => state.loading);
	loadingMore$ = this.select((state) => state.loadingMore);
	error$ = this.select((state) => state.error);
	selectedPluginId$ = this.select((state) => state.selectedPluginId);
	selectedInstallationId$ = this.select((state) => state.selectedInstallationId);
	pagination$ = this.select((state) => state.pagination);
	// Pagination selectors
	currentSkip$ = this.select((state) => state.pagination.skip);
	currentTake$ = this.select((state) => state.pagination.take);
	total$ = this.select((state) => state.pagination.total);
	hasMore$ = this.select((state) => state.pagination.hasMore);

	// Computed selectors
	get assignments(): PluginUserAssignment[] {
		return this.getValue().assignments;
	}

	get loading(): boolean {
		return this.getValue().loading;
	}

	get error(): string | null {
		return this.getValue().error;
	}

	get selectedPluginId(): string | null {
		return this.getValue().selectedPluginId;
	}

	get selectedInstallationId(): string | null {
		return this.getValue().selectedInstallationId;
	}

	get pagination() {
		return this.getValue().pagination;
	}

	get currentSkip(): number {
		return this.getValue().pagination.skip;
	}

	get currentTake(): number {
		return this.getValue().pagination.take;
	}

	get total(): number {
		return this.getValue().pagination.total;
	}

	get hasMore(): boolean {
		return this.getValue().pagination.hasMore;
	}

	get loadingMore(): boolean {
		return this.getValue().loadingMore;
	}

	// Get assignments for specific installation
	getAssignmentsForInstallation(installationId: string): Observable<PluginUserAssignment[]> {
		return this.assignments$.pipe(
			map((assignments) => assignments.filter((assignment) => assignment.pluginInstallationId === installationId))
		);
	}

	// Get assignments for specific user
	getAssignmentsForUser(userId: string): Observable<PluginUserAssignment[]> {
		return this.assignments$.pipe(
			map((assignments) => assignments.filter((assignment) => assignment.userId === userId))
		);
	}

	// Get active assignments only
	getActiveAssignments(): Observable<PluginUserAssignment[]> {
		return this.assignments$.pipe(map((assignments) => assignments.filter((assignment) => assignment.isActive)));
	}

	// Check if user has assignment
	hasUserAssignment(userId: string, installationId: string): Observable<boolean> {
		return this.assignments$.pipe(
			map((assignments) =>
				assignments.some(
					(assignment) =>
						assignment.userId === userId &&
						assignment.pluginInstallationId === installationId &&
						assignment.isActive
				)
			)
		);
	}

	// Get assignment count for installation
	getAssignmentCount(installationId: string): Observable<number> {
		return this.assignments$.pipe(
			map(
				(assignments) =>
					assignments.filter(
						(assignment) => assignment.pluginInstallationId === installationId && assignment.isActive
					).length
			)
		);
	}

	// Get users assigned to installation
	getAssignedUsers(installationId: string): Observable<any[]> {
		return this.assignments$.pipe(
			map((assignments) =>
				assignments
					.filter((assignment) => assignment.pluginInstallationId === installationId && assignment.isActive)
					.map((assignment) => assignment.user)
					.filter(Boolean)
			)
		);
	}

	// Check if has any assignments
	hasAssignments(): Observable<boolean> {
		return this.assignments$.pipe(map((assignments) => assignments.length > 0));
	}

	// Get error state
	hasError(): Observable<boolean> {
		return this.error$.pipe(map((error) => !!error));
	}

	// Get selection state
	hasSelection(): Observable<boolean> {
		return this.select(['selectedPluginId', 'selectedInstallationId']).pipe(
			map(({ selectedPluginId, selectedInstallationId }) => !!selectedPluginId && !!selectedInstallationId)
		);
	}
}

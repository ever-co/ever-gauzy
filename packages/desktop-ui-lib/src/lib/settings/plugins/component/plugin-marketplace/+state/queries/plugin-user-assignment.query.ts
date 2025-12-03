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
	selectedSubscriptionId$ = this.select((state) => state.selectedSubscriptionId);
	currentPluginTenantId$ = this.select((state) => state.currentPluginTenantId);
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

	get selectedSubscriptionId(): string | null {
		return this.getValue().selectedSubscriptionId;
	}

	get currentPluginTenantId(): string | null {
		return this.getValue().currentPluginTenantId;
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

	// Get assignments for specific subscription
	getAssignmentsForSubscription(subscriptionId: string): Observable<PluginUserAssignment[]> {
		return this.assignments$.pipe(
			map((assignments) => assignments.filter((assignment) => assignment.pluginSubscriptionId === subscriptionId))
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
	hasUserAssignment(userId: string, subscriptionId: string): Observable<boolean> {
		return this.assignments$.pipe(
			map((assignments) =>
				assignments.some(
					(assignment) =>
						assignment.userId === userId &&
						assignment.pluginSubscriptionId === subscriptionId &&
						assignment.isActive
				)
			)
		);
	}

	// Get assignment count for subscription
	getAssignmentCount(subscriptionId: string): Observable<number> {
		return this.assignments$.pipe(
			map(
				(assignments) =>
					assignments.filter(
						(assignment) => assignment.pluginSubscriptionId === subscriptionId && assignment.isActive
					).length
			)
		);
	}

	// Get users assigned to subscription
	getAssignedUsers(subscriptionId: string): Observable<any[]> {
		return this.assignments$.pipe(
			map((assignments) =>
				assignments
					.filter((assignment) => assignment.pluginSubscriptionId === subscriptionId && assignment.isActive)
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
		return this.select(['selectedPluginId', 'selectedSubscriptionId']).pipe(
			map(({ selectedPluginId, selectedSubscriptionId }) => !!selectedPluginId || !!selectedSubscriptionId)
		);
	}
}

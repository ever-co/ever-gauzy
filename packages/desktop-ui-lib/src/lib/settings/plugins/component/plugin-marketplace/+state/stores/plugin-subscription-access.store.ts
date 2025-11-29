// Plugin Subscription Access Store
// Manages state for subscription access operations using Akita

import { Injectable } from '@angular/core';
import { EntityState, EntityStore, StoreConfig } from '@datorama/akita';
import { IPluginSubscription, PluginScope } from '@gauzy/contracts';
import { IPluginSubscriptionAccessResponse } from '../../../../services/plugin-subscription-access.service';

/**
 * Plugin access state entity
 * Stores access information for each plugin
 */
export interface IPluginAccessState {
	pluginId: string;
	hasAccess: boolean;
	accessLevel?: PluginScope;
	canAssign: boolean;
	requiresSubscription: boolean;
	subscriptionId?: string;
	subscription?: IPluginSubscription;
	lastChecked: Date;
	loading: boolean;
	error?: string;
}

/**
 * User access check state
 * Stores access checks for specific users
 */
export interface IUserAccessCheck {
	id: string; // Composite key: pluginId:userId
	pluginId: string;
	userId: string;
	hasAccess: boolean;
	accessLevel?: PluginScope;
	checkedAt: Date;
}

/**
 * Assignment operation state
 * Tracks ongoing assignment/revocation operations
 */
export interface IAssignmentOperation {
	pluginId: string;
	type: 'assign' | 'revoke';
	userIds: string[];
	inProgress: boolean;
	error?: string;
	completedAt?: Date;
}

/**
 * Store state interface combining entity state and UI state
 */
export interface IPluginSubscriptionAccessEntityState extends EntityState<IPluginAccessState, string> {
	// Current plugin being managed
	selectedPluginId: string | null;

	// UI state
	assignmentDialogOpen: boolean;
	revocationDialogOpen: boolean;
	selectedUserIds: string[];

	// Operation state
	currentOperation: IAssignmentOperation | null;
	loading: boolean;
	error: string | null;

	// Bulk check state
	bulkCheckInProgress: boolean;
	lastBulkCheck?: Date;

	// User access checks cache (pluginId:userId => IUserAccessCheck)
	userAccessChecks: Record<string, IUserAccessCheck>;
}

/**
 * Create initial state
 */
export function createInitialAccessState(): IPluginSubscriptionAccessEntityState {
	return {
		selectedPluginId: null,
		assignmentDialogOpen: false,
		revocationDialogOpen: false,
		selectedUserIds: [],
		currentOperation: null,
		loading: false,
		error: null,
		bulkCheckInProgress: false,
		userAccessChecks: {}
	};
}

/**
 * Plugin Subscription Access Store
 * Stores plugin access information with entity management
 */
@StoreConfig({ name: '_plugin_subscription_access', idKey: 'pluginId' })
@Injectable({ providedIn: 'root' })
export class PluginSubscriptionAccessStore extends EntityStore<
	IPluginSubscriptionAccessEntityState,
	IPluginAccessState
> {
	constructor() {
		super(createInitialAccessState());
	}

	/**
	 * Set plugin access state
	 */
	setPluginAccess(pluginId: string, response: IPluginSubscriptionAccessResponse): void {
		const accessState: IPluginAccessState = {
			pluginId,
			hasAccess: response.hasAccess,
			accessLevel: response.accessLevel,
			canAssign: response.canAssign || false,
			requiresSubscription: response.requiresSubscription,
			subscriptionId: response.subscription?.id,
			subscription: response.subscription,
			lastChecked: new Date(),
			loading: false,
			error: undefined
		};

		this.upsert(pluginId, accessState);
		this.update({ loading: false, error: null });
	}

	/**
	 * Set plugin access loading state
	 */
	setPluginAccessLoading(pluginId: string, loading: boolean): void {
		this.update(pluginId, { loading });
	}

	/**
	 * Set plugin access error
	 */
	setPluginAccessError(pluginId: string, error: string): void {
		this.update(pluginId, { loading: false, error });
		this.update({ loading: false, error });
	}

	/**
	 * Set user access check
	 */
	setUserAccessCheck(pluginId: string, userId: string, response: IPluginSubscriptionAccessResponse): void {
		const id = `${pluginId}:${userId}`;
		const userAccessCheck: IUserAccessCheck = {
			id,
			pluginId,
			userId,
			hasAccess: response.hasAccess,
			accessLevel: response.accessLevel,
			checkedAt: new Date()
		};

		this.update((state) => ({
			userAccessChecks: {
				...state.userAccessChecks,
				[id]: userAccessCheck
			}
		}));
	}

	/**
	 * Set bulk access results
	 */
	setBulkAccessResults(accessMap: Map<string, IPluginSubscriptionAccessResponse>): void {
		const accessStates: IPluginAccessState[] = [];

		accessMap.forEach((response, pluginId) => {
			accessStates.push({
				pluginId,
				hasAccess: response.hasAccess,
				accessLevel: response.accessLevel,
				canAssign: response.canAssign || false,
				requiresSubscription: response.requiresSubscription,
				subscriptionId: response.subscription?.id,
				lastChecked: new Date(),
				loading: false,
				error: undefined
			});
		});

		this.set(accessStates);
		this.update({
			bulkCheckInProgress: false,
			lastBulkCheck: new Date(),
			loading: false,
			error: null
		});
	}

	/**
	 * Clear plugin access cache
	 */
	clearPluginAccessCache(pluginId: string): void {
		this.remove(pluginId);
	}

	/**
	 * Clear all access cache
	 */
	clearAllAccessCache(): void {
		this.set([]);
		this.update({ userAccessChecks: {} });
	}

	/**
	 * Set assignment dialog state
	 */
	setAssignmentDialog(open: boolean, pluginId?: string): void {
		this.update({
			assignmentDialogOpen: open,
			selectedPluginId: pluginId || null
		});
	}

	/**
	 * Set revocation dialog state
	 */
	setRevocationDialog(open: boolean, pluginId?: string, userIds?: string[]): void {
		this.update({
			revocationDialogOpen: open,
			selectedPluginId: pluginId || null,
			selectedUserIds: userIds || []
		});
	}

	/**
	 * Set loading state
	 */
	setLoading(loading: boolean): void {
		this.update({ loading });
	}

	/**
	 * Set error state
	 */
	setAccessError(error: string | null): void {
		this.update({ error, loading: false });
	}

	/**
	 * Reset error state
	 */
	resetError(): void {
		this.update({ error: null });
	}

	/**
	 * Reset entire store
	 */
	resetStore(): void {
		this.set([]);
		this.update(createInitialAccessState());
	}
}

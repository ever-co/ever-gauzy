import { ID, IPlugin } from '@gauzy/contracts';
import { createAction, props } from '@ngneat/effects';
import {
	BulkAssignPluginUsersRequest,
	GetPluginUserAssignmentsRequest,
	PluginUserAssignment
} from '../stores/plugin-user-assignment.store';

export const PluginUserAssignmentActions = {
	// Load plugin user assignments
	loadAssignments: createAction(
		'[Plugin User Assignment] Load Assignments',
		props<GetPluginUserAssignmentsRequest & { take?: number; skip?: number; append?: boolean }>()
	),
	loadAssignmentsSuccess: createAction(
		'[Plugin User Assignment] Load Assignments Success',
		props<{ assignments: PluginUserAssignment[]; total: number; append?: boolean }>()
	),
	loadAssignmentsFailure: createAction(
		'[Plugin User Assignment] Load Assignments Failure',
		props<{ error: string }>()
	),

	// Load more assignments (infinite scroll)
	loadMoreAssignments: createAction(
		'[Plugin User Assignment] Load More Assignments',
		props<GetPluginUserAssignmentsRequest>()
	),
	loadMoreAssignmentsSuccess: createAction(
		'[Plugin User Assignment] Load More Assignments Success',
		props<{ assignments: PluginUserAssignment[]; total: number }>()
	),
	loadMoreAssignmentsFailure: createAction(
		'[Plugin User Assignment] Load More Assignments Failure',
		props<{ error: string }>()
	),

	// Assign users to plugin (subscription-based)
	assignUsers: createAction(
		'[Plugin User Assignment] Assign Users',
		props<{ pluginId: ID; userIds: string[]; reason?: string }>()
	),
	assignUsersSuccess: createAction(
		'[Plugin User Assignment] Assign Users Success',
		props<{ message: string; assignedUsers: number }>()
	),
	assignUsersFailure: createAction('[Plugin User Assignment] Assign Users Failure', props<{ error: string }>()),

	// Unassign user from plugin (subscription-based revocation)
	unassignUser: createAction('[Plugin User Assignment] Unassign User', props<{ pluginId: ID; userId: ID }>()),
	unassignUserSuccess: createAction(
		'[Plugin User Assignment] Unassign User Success',
		props<{ message: string; revokedUsers: number }>()
	),
	unassignUserFailure: createAction('[Plugin User Assignment] Unassign User Failure', props<{ error: string }>()),

	// Bulk assign users
	bulkAssignUsers: createAction('[Plugin User Assignment] Bulk Assign Users', props<BulkAssignPluginUsersRequest>()),
	bulkAssignUsersSuccess: createAction(
		'[Plugin User Assignment] Bulk Assign Users Success',
		props<{ assignments: PluginUserAssignment[] }>()
	),
	bulkAssignUsersFailure: createAction(
		'[Plugin User Assignment] Bulk Assign Users Failure',
		props<{ error: string }>()
	),

	// Get user assignment details
	getUserAssignmentDetails: createAction(
		'[Plugin User Assignment] Get User Assignment Details',
		props<{ pluginId: ID; installationId: ID; userId: ID }>()
	),
	getUserAssignmentDetailsSuccess: createAction(
		'[Plugin User Assignment] Get User Assignment Details Success',
		props<{ hasAccess: boolean; assignment?: PluginUserAssignment }>()
	),
	getUserAssignmentDetailsFailure: createAction(
		'[Plugin User Assignment] Get User Assignment Details Failure',
		props<{ error: string }>()
	),

	// Check user access (subscription-based)
	checkUserAccess: createAction('[Plugin User Assignment] Check User Access', props<{ pluginId: ID; userId: ID }>()),
	checkUserAccessSuccess: createAction(
		'[Plugin User Assignment] Check User Access Success',
		props<{ hasAccess: boolean }>()
	),
	checkUserAccessFailure: createAction(
		'[Plugin User Assignment] Check User Access Failure',
		props<{ error: string }>()
	),

	// Open user assignment dialog
	manageUsers: createAction('[Plugin User Assignment] Manage Users', props<{ plugin: IPlugin }>()),

	// UI state management
	selectPlugin: createAction(
		'[Plugin User Assignment] Select Plugin',
		props<{ pluginId: string; installationId: string }>()
	),
	clearSelection: createAction('[Plugin User Assignment] Clear Selection'),
	clearAssignments: createAction('[Plugin User Assignment] Clear Assignments'),
	clearError: createAction('[Plugin User Assignment] Clear Error'),

	// Pagination management
	setSkip: createAction('[Plugin User Assignment] Set Skip', props<{ skip: number }>()),
	setTake: createAction('[Plugin User Assignment] Set Take', props<{ take: number }>()),
	resetPagination: createAction('[Plugin User Assignment] Reset Pagination')
};

import { ID } from '@gauzy/contracts';
import { createAction, props } from '@ngneat/effects';
import {
	AssignPluginUsersRequest,
	BulkAssignPluginUsersRequest,
	GetPluginUserAssignmentsRequest,
	PluginUserAssignment,
	UnassignPluginUserRequest
} from '../stores/plugin-user-assignment.store';

export const PluginUserAssignmentActions = {
	// Load plugin user assignments
	loadAssignments: createAction(
		'[Plugin User Assignment] Load Assignments',
		props<GetPluginUserAssignmentsRequest>()
	),
	loadAssignmentsSuccess: createAction(
		'[Plugin User Assignment] Load Assignments Success',
		props<{ assignments: PluginUserAssignment[] }>()
	),
	loadAssignmentsFailure: createAction(
		'[Plugin User Assignment] Load Assignments Failure',
		props<{ error: string }>()
	),

	// Assign users to plugin
	assignUsers: createAction('[Plugin User Assignment] Assign Users', props<AssignPluginUsersRequest>()),
	assignUsersSuccess: createAction(
		'[Plugin User Assignment] Assign Users Success',
		props<{ assignments: PluginUserAssignment[] }>()
	),
	assignUsersFailure: createAction('[Plugin User Assignment] Assign Users Failure', props<{ error: string }>()),

	// Unassign user from plugin
	unassignUser: createAction('[Plugin User Assignment] Unassign User', props<UnassignPluginUserRequest>()),
	unassignUserSuccess: createAction(
		'[Plugin User Assignment] Unassign User Success',
		props<{ pluginId: ID; installationId: ID; userId: ID }>()
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

	// Check user access
	checkUserAccess: createAction(
		'[Plugin User Assignment] Check User Access',
		props<{ pluginId: ID; installationId: ID; userId: ID }>()
	),
	checkUserAccessSuccess: createAction(
		'[Plugin User Assignment] Check User Access Success',
		props<{ hasAccess: boolean }>()
	),
	checkUserAccessFailure: createAction(
		'[Plugin User Assignment] Check User Access Failure',
		props<{ error: string }>()
	),

	// UI state management
	selectPlugin: createAction(
		'[Plugin User Assignment] Select Plugin',
		props<{ pluginId: string; installationId: string }>()
	),
	clearSelection: createAction('[Plugin User Assignment] Clear Selection'),
	clearAssignments: createAction('[Plugin User Assignment] Clear Assignments'),
	clearError: createAction('[Plugin User Assignment] Clear Error')
};

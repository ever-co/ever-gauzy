import { ZObject, Bundle } from 'zapier-platform-core';

/**
 * Ensures date fields are properly formatted in ISO-8601 format
 * This helps prevent T003 warnings from Zapier validation
 */

export interface DateFormatTable {
	[key: string]: any;
	lastLog?: DateFormatTable;
}

/** Formats a single date field to ISO-8601 format */
const formatSingleDateField = (value: any): string | null => {
	if (!value) return null;
	const date = new Date(value);
	return isNaN(date.getTime()) ? null : date.toISOString();
};

const formatDateFields = (item: DateFormatTable): DateFormatTable => {
	const dateFields = ['createdAt', 'updatedAt', 'startedAt', 'stoppedAt', 'editedAt', 'archivedAt', 'deletedAt'];

	const formatted = { ...item };

	dateFields.forEach((field) => {
		formatted[field] = formatSingleDateField(formatted[field]);
	});

	// Also format nested lastLog dates if present
	if (formatted.lastLog && typeof formatted.lastLog === 'object') {
		dateFields.forEach((field) => {
			if (formatted.lastLog) {
				formatted.lastLog[field] = formatSingleDateField(formatted.lastLog[field]);
			}
		});
	}

	return formatted;
};

const perform = async (z: ZObject, bundle: Bundle) => {
	try {
		const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
		const response = await z.request({
			url: `${baseUrl}/api/timesheet/timer/status`,
			method: 'GET',
			headers: {
				Authorization: `Bearer ${bundle.authData.access_token}`
			}
		});
		const data = response.data;

		// Convert single object to array if needed
		if (!Array.isArray(data)) {
			return [
				formatDateFields({
					id: new Date().toISOString(), // Use ISO timestamp as ID for webhook mode
					...data
				})
			];
		}

		return data.map((item: { id?: string; [key: string]: any }) =>
			formatDateFields({
				id: item.id || new Date().toISOString(),
				...item
			})
		);
	} catch (error) {
		z.console.error('Error fetching timer status:', error);
		throw new Error('Failed to fetch timer status');
	}
};

/**
 * Performs the polling action for the trigger
 * This is used as a fallback when webhooks aren't available
 */
const performList = async (z: ZObject, bundle: Bundle) => {
	try {
		const response = await z.request({
			url: `${process.env.API_BASE_URL}/api/timesheet/timer/status/worked`,
			method: 'GET',
			headers: {
				Authorization: `Bearer ${bundle.authData['access_token']}`
			},
			params: {
				limit: 10
			}
		});

		// Check HTTP response status
		if (response.status !== 200) {
			throw new Error(`Unexpected response status: ${response.status}`);
		}

		// Validate response format
		if (!response.data || !Array.isArray(response.data)) {
			throw new Error('Unexpected API response format');
		}

		// Handle partial or missing data with proper date formatting
		return response.data.map((item: any) =>
			formatDateFields({
				id: item.lastLog?.id || new Date().toISOString(),
				duration: item.duration || 0, // Fallback for missing duration
				running: item.running || false, // Fallback for missing running status
				lastLog: item.lastLog || {}, // Fallback for missing lastLog
				...item
			})
		);
	} catch (error: any) {
		z.console.error('Error polling timer status:', error);
		throw new Error(`Failed to poll timer status: ${error.message || 'Unknown error'}`);
	}
};

// Subscribe function - creates a webhook subscription
const subscribe = async (z: ZObject, bundle: Bundle) => {
	try {
		const response = await z.request({
			url: `${process.env.API_BASE_URL}/api/integration/zapier/webhooks`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${bundle.authData['access_token']}`
			},
			body: {
				target_url: bundle.targetUrl, // Zapier provides this
				event: 'timer.status.changed' // Your event type
			}
		});
		return response.data;
	} catch (error) {
		z.console.error('Error creating webhook subscription:', error);
		throw new Error('Failed to create webhook subscription');
	}
};

// Unsubscribe function - removes the webhook subscription
const unsubscribe = async (z: ZObject, bundle: Bundle) => {
	const response = await z.request({
		url: `${process.env.API_BASE_URL}/api/integration/zapier/webhooks/${bundle.subscribeData?.id}`,
		method: 'DELETE',
		headers: {
			Authorization: `Bearer ${bundle.authData['access_token']}`
		}
	});
	return response.data;
};

export const timerStatusKey = 'timer_status';

export default {
	key: timerStatusKey,
	noun: 'Timer',
	display: {
		label: 'Timer Status',
		description: 'Triggers when timer status changes in Gauzy.'
	},
	operation: {
		type: 'hook',
		perform,
		performList,
		performSubscribe: subscribe,
		performUnsubscribe: unsubscribe,
		// Comprehensive sample with all date fields properly formatted
		sample: {
			id: '55a664ca-7266-4e71-b37a-dfc1fe824478',
			duration: 91,
			running: false,
			createdAt: '2025-01-04T10:08:15.264Z',
			updatedAt: '2025-01-04T10:09:46.595Z',
			lastLog: {
				deletedAt: null,
				createdAt: '2025-01-04T10:08:15.264Z',
				updatedAt: '2025-01-04T10:09:46.595Z',
				createdByUserId: '488ad51e-667f-4cac-98cb-7ee343227d1b',
				updatedByUserId: '488ad51e-667f-4cac-98cb-7ee343227d1b',
				deletedByUserId: null,
				id: '55a664ca-7266-4e71-b37a-dfc1fe824478',
				isActive: true,
				isArchived: false,
				archivedAt: null,
				tenantId: '88507509-f7cb-44f4-ae60-894f950477a9',
				organizationId: 'b894c374-7374-43cb-a1a2-afe46b9f5e28',
				startedAt: '2025-01-04T10:08:15.145Z',
				stoppedAt: '2025-01-04T10:09:46.571Z',
				editedAt: null,
				logType: 'TRACKED',
				source: 'BROWSER',
				description: 'connect timer starter to the Zapier plugin for automation',
				reason: null,
				isBillable: false,
				isRunning: false,
				version: '1.0.1',
				employeeId: '82f0fb75-6206-43da-93df-6a7ce6d4fcef',
				timesheetId: 'c752adf7-5999-42e9-9f11-f95a0a00e75d',
				projectId: '29bd6ac8-1408-4933-a8db-f50740a994b8',
				taskId: '0e6ac2e7-0094-4166-852e-62bf1731ecfb',
				organizationContactId: '5e1f12b4-ee2d-40a4-ad1d-593e868da57b',
				organizationTeamId: '4d0a52f1-4fdd-4a64-9706-51b6182a48cf',
				duration: 91,
				isEdited: false
			}
		},
		// Add output fields documentation to help Zapier understand date fields
		outputFields: [
			{ key: 'id', label: 'ID', type: 'string' },
			{ key: 'duration', label: 'Duration (seconds)', type: 'integer' },
			{ key: 'running', label: 'Is Running', type: 'boolean' },
			{ key: 'createdAt', label: 'Created At', type: 'datetime' },
			{ key: 'updatedAt', label: 'Updated At', type: 'datetime' },
			{ key: 'lastLog.id', label: 'Last Log ID', type: 'string' },
			{ key: 'lastLog.createdAt', label: 'Last Log Created At', type: 'datetime' },
			{ key: 'lastLog.updatedAt', label: 'Last Log Updated At', type: 'datetime' },
			{ key: 'lastLog.startedAt', label: 'Started At', type: 'datetime' },
			{ key: 'lastLog.stoppedAt', label: 'Stopped At', type: 'datetime' },
			{ key: 'lastLog.editedAt', label: 'Edited At', type: 'datetime' },
			{ key: 'lastLog.archivedAt', label: 'Archived At', type: 'datetime' },
			{ key: 'lastLog.deletedAt', label: 'Deleted At', type: 'datetime' },
			{ key: 'lastLog.description', label: 'Description', type: 'string' },
			{ key: 'lastLog.logType', label: 'Log Type', type: 'string' },
			{ key: 'lastLog.source', label: 'Source', type: 'string' },
			{ key: 'lastLog.isBillable', label: 'Is Billable', type: 'boolean' },
			{ key: 'lastLog.isRunning', label: 'Is Running', type: 'boolean' }
		]
	}
};

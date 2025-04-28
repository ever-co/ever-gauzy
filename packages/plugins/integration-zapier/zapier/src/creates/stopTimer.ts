import { ZObject, Bundle } from 'zapier-platform-core';

const appName = process.env.APP_NAME || 'Gauzy';

const perform = async (z: ZObject, bundle: Bundle) => {
  try {
    const response = await z.request({
      url: `${process.env.API_BASE_URL}/api/timesheet/timer/stop`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bundle.authData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: {
        tenantId: bundle.inputData['tenantId'],
        organizationId: bundle.inputData['organizationId'],
        sentTo: bundle.inputData['sentTo'],
        logType: bundle.inputData['logType'],
        source: bundle.inputData['source'],
        description: bundle.inputData['description'],
        isBillable: bundle.inputData['isBillable'] === 'true',
        version: bundle.inputData['version'],
        projectId: bundle.inputData['projectId'],
        taskId: bundle.inputData['taskId'],
        organizationContactId: bundle.inputData['organizationContactId'],
        organizationTeamId: bundle.inputData['organizationTeamId'],
      },
    });
    return response.data;
  } catch (error: any) {
    z.console.error('Error stopping timer:', { error });
    throw new Error(`Failed to stop timer: ${error.message || 'Unknown error'}`);
  }
};

export const stopTimerKey = 'stop_timer';

export default {
  key: stopTimerKey,
  noun: 'Timer',
  display: {
    label: 'Stop Timer',
    description: `Stops a timer in ${appName}.`
  },
  operation: {
    inputFields: [
      {
        key: 'tenantId',
        type: 'string',
        required: true,
        label: 'Tenant',
        dynamic: 'tenant_list.id.name',
        helpText: 'Select the tenant for this timer'
      },
      {
        key: 'organizationId',
        type: 'string',
        required: true,
        label: 'Organization',
        dynamic: 'organization_list.id.name',
        helpText: 'Select the organization for this timer'
      },
      { key: 'sentTo', type: 'string', required: false, label: 'Sent To' },
      {
        key: 'logType',
        type: 'string',
        required: false,
        label: 'Log Type',
        choices: {
          TRACKED: 'Tracked',
          MANUAL: 'Manual',
          IDLE: 'Idle',
          RESUMED: 'Resumed',
        },
        default: 'TRACKED',
      },
      {
        key: 'source',
        type: 'string',
        required: false,
        label: 'Source',
        choices: {
          BROWSER: 'Browser',
          DESKTOP: 'Desktop',
          MOBILE: 'Mobile',
          BROWSER_EXTENSION: 'Browser Extension',
          HUBSTAFF: 'Hubstaff',
          UPWORK: 'Upwork',
          TEAMS: 'Teams',
          CLOC: 'Cloc',
        },
        default: 'BROWSER',
        helpText: 'The source of this timer entry'
      },
      {
        key: 'description',
        type: 'text',
        required: false,
        label: 'Description',
        helpText: 'A description of the work being tracked'
      },
      {
        key: 'isBillable',
        type: 'boolean',
        required: false,
        label: 'Is Billable',
        default: 'false',
        helpText: 'Whether this time is billable or not'
      },
      { key: 'version', type: 'string', required: false, label: 'Version', default: '1.0.1' },
      {
        key: 'projectId',
        type: 'string',
        required: false,
        label: 'Project',
        dynamic: 'project_list.id.name',
        helpText: 'The project associated with this timer'
      },
      {
        key: 'taskId',
        type: 'string',
        required: false,
        label: 'Task',
        dynamic: 'task_list.id.name',
        helpText: 'The task associated with this timer'
      },
      {
        key: 'organizationContactId',
        type: 'string',
        required: false,
        label: 'Organization Contact',
        dynamic: 'organization_contact_list.id.name',
        helpText: 'The client or contact associated with this timer'
      },
      {
        key: 'organizationTeamId',
        type: 'string',
        required: false,
        label: 'Team',
        dynamic: 'organization_team_list.id.name',
        helpText: 'The team associated with this timer'
      },
    ],
    perform,
    sample: {
      id: '55a664ca-7266-4e71-b37a-dfc1fe824478',
      tenantId: '88507509-f7cb-44f4-ae60-894f950477a9',
      organizationId: 'b894c374-7374-43cb-a1a2-afe46b9f5e28',
      sentTo: 'da2117d6-e6f6-45ec-86cb-80cc20470ba4',
      logType: 'TRACKED',
      source: 'BROWSER',
      description: 'Timer stopped via Zapier integration',
      isBillable: false,
      version: '1.0.1',
      projectId: '29bd6ac8-1408-4933-a8db-f50740a994b8',
      taskId: '0e6ac2e7-0094-4166-852e-62bf1731ecfb',
      organizationContactId: '2db881af-ecf8-4a8a-93a7-9655a3e6da7b',
      organizationTeamId: '4d0a52f1-4fdd-4a64-9706-51b6182a48cf',
    },
  },
};

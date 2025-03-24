import { ZObject, Bundle } from 'zapier-platform-core';

const perform = async (z: ZObject, bundle: Bundle) => {
  try {
    const response = await z.request({
      url: `${process.env.API_BASE_URL}/api/timesheet/timer/stop`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bundle.authData['access_token']}`,
      },
      body: {
        startedAt: bundle.inputData['startedAt'],
        tenantId: bundle.inputData['tenantId'],
        organizationId: bundle.inputData['organizationId'],
        sentTo: bundle.inputData['sentTo'],
        logType: bundle.inputData['logType'],
        source: bundle.inputData['source'],
        description: bundle.inputData['description'],
        isBillable: bundle.inputData['isBillable'],
        version: bundle.inputData['version'],
        projectId: bundle.inputData['projectId'],
        taskId: bundle.inputData['taskId'],
        organizationContactId: bundle.inputData['organizationContactId'],
        organizationTeamId: bundle.inputData['organizationTeamId'],
      },
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to stop timer');
  }
};

export const stopTimerKey = 'stop_timer';

export default {
  key: stopTimerKey,
  noun: 'Timer',
  display: {
    label: 'Stop Timer',
    description: 'Stops a timer in Gauzy.',
  },
  operation: {
    inputFields: [
      { key: 'startedAt', type: 'datetime', required: true, label: 'Started At' },
      { key: 'tenantId', type: 'string', required: true, label: 'Tenant ID' },
      { key: 'organizationId', type: 'string', required: true, label: 'Organization ID' },
      { key: 'sentTo', type: 'string', required: false, label: 'Sent To' },
      {
        key: 'logType',
        type: 'string',
        required: false,
        label: 'Log Type',
        choices: {
          'TRACKED': 'Tracked',
          'MANUAL': 'Manual',
          'IDLE': 'Idle',
          'RESUMED': 'Resumed'
        },
        default: 'TRACKED'
      },
      {
        key: 'source',
        type: 'string',
        required: false,
        label: 'Source',
        choices: {
          'BROWSER': 'Browser',
          'DESKTOP': 'Desktop',
          'MOBILE': 'Mobile',
          'BROWSER_EXTENSION': 'Browser Extension',
          'HUBSTAFF': 'Hubstaff',
          'UPWORK': 'Upwork',
          'TEAMS': 'Teams',
          'CLOC': 'Cloc'
        },
        default: 'BROWSER'
      },
      { key: 'description', type: 'text', required: false, label: 'Description' },
      { key: 'isBillable', type: 'boolean', required: false, label: 'Is Billable', default: false },
      { key: 'version', type: 'string', required: false, label: 'Version', default: '1.0.1' },
      { key: 'projectId', type: 'string', required: false, label: 'Project ID' },
      { key: 'taskId', type: 'string', required: false, label: 'Task ID' },
      { key: 'organizationContactId', type: 'string', required: false, label: 'Organization Contact ID' },
      { key: 'organizationTeamId', type: 'string', required: false, label: 'Organization Team ID' },
    ],
    type: 'create',
    perform,
    sample: {
      id: 1,
      startedAt: '2023-10-01T12:00:00Z',
      tenantId: 'c0e9945f-6a44-4848-8bd4-d8b852fcade0',
      organizationId: '9564edd7-7d36-47be-a89a-3142f5d53ce8',
      sentTo: 'da2117d6-e6f6-45ec-86cb-80cc20470ba4',
      logType: 'TRACKED',
      source: 'BROWSER',
      description: 'connect timer stopper to the Make.com custom app',
      isBillable: false,
      version: '1.0.1',
      projectId: '3e44becd-ccc0-4e86-90fd-16d2347d90d9',
      taskId: '1ccb7c08-e381-4802-a005-96af0f9ad214',
      organizationContactId: '2db881af-ecf8-4a8a-93a7-9655a3e6da7b',
      organizationTeamId: '4d69775a-86c5-4d2c-a095-5b095a2d7f15'
    },
  },
};

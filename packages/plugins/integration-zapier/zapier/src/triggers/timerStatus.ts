import { ZObject, Bundle } from 'zapier-platform-core';

const perform = async (z: ZObject, bundle: Bundle) => {
  try {
    const response = await z.request({
      url: `${process.env.API_BASE_URL}/api/timesheet/timer/status`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bundle.authData['access_token']}`,
      },
    });
    return response.data;
  } catch (error) {
    z.console.error('Error fetching timer status:', error);
    throw new Error('Failed to fetch timer status');
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
        Authorization: `Bearer ${bundle.authData['access_token']}`,
      },
      body: {
        target_url: bundle.targetUrl, // Zapier provides this
        event: 'timer.status.changed', // Your event type
      },
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
      Authorization: `Bearer ${bundle.authData['access_token']}`,
    },
  });
  return response.data;
};

export const timerStatusKey = 'timer_status';

export default {
  key: timerStatusKey,
  noun: 'Timer',
  display: {
    label: 'Timer Status',
    description: 'Triggers when timer status changes in Gauzy.',
  },
  operation: {
    type: 'hook',
    perform,
    performSubscribe: subscribe,
    performUnsubscribe: unsubscribe,
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
      organizationTeamId: '4d69775a-86c5-4d2c-a095-5b095a2d7f15',
    },
  },
};

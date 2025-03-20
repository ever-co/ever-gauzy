import { ZObject, Bundle } from 'zapier-platform-core';

const perform = async (z: ZObject, bundle: Bundle) => {
    const response = await z.request({
      url: 'https://api.gauzy.co/api/timesheet/timer/status',
      method: 'GET',
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
      description: 'Triggers when fetching timer status in Gauzy.',
    },
    operation: {
      type: 'hook',
      perform,
      sample: {

      }
    },
  };

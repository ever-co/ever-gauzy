// index.ts
import { version as platformVersion } from 'zapier-platform-core';
import { authentication } from './authentication';

const { version } = require('../package.json');

import startTimer, { startTimerKey } from './creates/startTimer';
import stopTimer, { stopTimerKey } from './creates/stopTimer';
import timerStatus, { timerStatusKey } from './triggers/timerStatus';

// Import hidden triggers for dynamic dropdowns
import tenantList from './triggers/tenantList';
import organizationList from './triggers/organizationList';
import projectList from './triggers/projectList';
import taskList from './triggers/taskList';
import organizationContactList from './triggers/organizationContactList';
import organizationTeamList from './triggers/organizationTeamList';

/**
 * Zapier App Definition
 */
export default {
  version,
  platformVersion,
  authentication,

  // Triggers that users can use to start Zaps
  triggers: {
    [timerStatusKey]: timerStatus,

    // Hidden triggers for dynamic dropdowns
    tenant_list: tenantList,
    organization_list: organizationList,
    project_list: projectList,
    task_list: taskList,
    organization_contact_list: organizationContactList,
    organization_team_list: organizationTeamList,
  },

  // Actions that users can use in Zaps
  creates: {
    [startTimerKey]: startTimer,
    [stopTimerKey]: stopTimer
  },
};

import { version as platformVersion } from 'zapier-platform-core';
import { authentication } from './authentication';

const { version } = require('../package.json');
import startTimer, { startTimerKey } from './creates/startTimer';
import stopTimer, { stopTimerKey } from './creates/stopTimer';
import timerStatus, { timerStatusKey } from './triggers/timerStatus';

export default {
  version,
  platformVersion,
  authentication: authentication,
  triggers: {
    [timerStatusKey]: timerStatus,
  },
  creates: {
    [startTimerKey]: startTimer,
    [stopTimerKey]: stopTimer
  },
};

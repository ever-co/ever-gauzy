import { SimTimerStartedHandler } from './sim-timer-started.handler';
import { SimTimerStoppedHandler } from './sim-timer-stopped.handler';
import { SimTimerStatusUpdatedHandler } from './sim-timer-status-updated.handler';
import { SimTaskEventHandler } from './sim-task-event.handler';
import { SimScreenshotEventHandler } from './sim-screenshot-event.handler';
import { SimIntegrationEventHandler } from './sim-integration-event.handler';
import { SimAccountRegistrationHandler } from './sim-account-registration.handler';
import { SimAccountVerifiedHandler } from './sim-account-verified.handler';

export const EventHandlers = [
	SimTimerStartedHandler,
	SimTimerStoppedHandler,
	SimTimerStatusUpdatedHandler,
	SimTaskEventHandler,
	SimScreenshotEventHandler,
	SimIntegrationEventHandler,
	SimAccountRegistrationHandler,
	SimAccountVerifiedHandler
];

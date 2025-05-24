/** Base URL for ActivePieces integration endpoints */
export const ACTIVEPIECES_API_URL = 'https://cloud.activepieces.com/api/v1';

/** URL for initiating OAuth authorization flow with Gauzy */
export const ACTIVEPIECES_AUTHORIZATION_URL = `${process.env['API_BASE_URL']}/api/integration/activepieces/oauth/authorize`;

/** URL for OAuth callback after user authorization */
export const ACTIVEPIECES_CALLBACK_URL = `${process.env['API_BASE_URL']}/api/integration/activepieces/oauth/callback`;

/** URL for obtaining OAuth access tokens from Gauzy */
export const ACTIVEPIECES_TOKEN_URL = `${process.env['API_BASE_URL']}/api/integration/activepieces/token`;

/** OAuth token expiration time in seconds (1 hour) */
export const ACTIVEPIECES_TOKEN_EXPIRATION_TIME = 3600;

/** ActivePieces OAuth scopes */
export const ACTIVEPIECES_SCOPES = ['read', 'write', 'flows:manage'];

/** ActivePieces webhook events */
export const ACTIVEPIECES_WEBHOOK_EVENTS = [
    'employee.created',
    'employee.updated',
    'employee.deleted',
    'task.created',
    'task.updated',
    'task.deleted',
    'timesheet.time-log.created',
    'timesheet.time-log.updated',
    'project.created',
    'project.updated',
    'timer.start',
    'timer.stop',
];

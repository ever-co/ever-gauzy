export const TOKEN_CLEANUP_EXPIRED_SCHEDULE = 'token.cleanup.expired.schedule';
export const TOKEN_CLEANUP_INACTIVE_SCHEDULER = 'token.cleanup.inactive.scheduler';
export const TOKEN_QUEUE_NAME = 'token-maintenance';
export const TOKEN_CLEANUP_EXPIRED_JOB = 'token.cleanup.expired';
export const TOKEN_CLEANUP_INACTIVE_JOB = 'token.cleanup.inactive';
export const TOKEN_WORKER_ENABLED = process.env.WORKER_QUEUE_ENABLED !== 'false' && process.env.REDIS_ENABLED === 'true';

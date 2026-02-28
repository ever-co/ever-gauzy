export const WORKER_DEFAULT_QUEUE = process.env.WORKER_DEFAULT_QUEUE || 'worker-default';
export const WORKER_QUEUE_ENABLED = process.env.WORKER_QUEUE_ENABLED !== 'false' && process.env.REDIS_ENABLED === 'true';

/** The integration's settings read from the environment once (`EverWorksConfig`). */
export const EVER_WORKS_CONFIG = Symbol('EVER_WORKS_CONFIG');

/** The environment the module reads (`process.env` unless a test provides its own). */
export const EVER_WORKS_ENV = Symbol('EVER_WORKS_ENV');

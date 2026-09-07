/**
 * Public API Surface of @gauzy/plugin-knowledge-base
 */
export * from './lib/knowledge-base.plugin';

// Entity classes (exported for typing / read-only repository access by other plugins —
// e.g. the Documents plugin legacy import; consumers must NOT register them again).
export * from './lib/entities';

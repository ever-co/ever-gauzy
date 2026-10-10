/**
 * The schema this plugin owns.
 *
 * A package installs its own tables: the migration classes are declared in the plugin metadata and
 * merged into the connection's migration list, so nothing in `packages/core` has to know that this
 * package exists.
 */
export * from './migrations';

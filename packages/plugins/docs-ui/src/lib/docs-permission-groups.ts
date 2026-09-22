import { PermissionsEnum } from '@gauzy/contracts';

/**
 * Frozen, shared permission arrays for `*ngxPermissionsOnly`.
 *
 * ## 🛑 Why these exist — this caused a hard browser hang
 *
 * An inline array literal in the binding — `*ngxPermissionsOnly="[permissions.DOCS_UPDATE]"`, the
 * shape this package used everywhere — builds a **new array on every
 * change-detection cycle**. `NgxPermissionsDirective` compares its input by reference, so a fresh
 * array means `ngOnChanges` fires every single cycle; each fire runs `validateOnlyPermissions()`,
 * which resolves a `Promise.all`. Under **default** change detection — which nearly every
 * component in this package uses — that microtask resolution makes Zone schedule another
 * application-wide tick, which rebuilds the array, which fires `ngOnChanges` again.
 *
 * The result is an unbreakable loop that pins the main thread: the Documents route never paints
 * and the tab stops responding entirely (Chrome reports the renderer as unresponsive). It is not
 * a slow page — it is a page that can never finish one cycle.
 *
 * Binding one of the frozen arrays below keeps the reference identical across cycles, so
 * `ngOnChanges` fires once and the loop cannot start.
 *
 * ## Rules
 *
 * - **Never** write an array literal in an `ngxPermissionsOnly` binding. Use a constant here.
 * - Adding a new gate means adding a named group here, not inlining `[PermissionsEnum.X]`.
 * - `Object.freeze` is belt-and-braces: it makes an accidental in-place `push` throw in dev
 *   rather than silently mutating a value shared by every component in the package.
 *
 * The same hazard exists for any directive input bound to a literal under default change
 * detection; permissions are simply where it bit us, because the directive resolves a promise.
 */
export const DOCS_PERMISSIONS = Object.freeze({
	read: Object.freeze([PermissionsEnum.DOCS_READ]) as PermissionsEnum[],
	create: Object.freeze([PermissionsEnum.DOCS_CREATE]) as PermissionsEnum[],
	update: Object.freeze([PermissionsEnum.DOCS_UPDATE]) as PermissionsEnum[],
	delete: Object.freeze([PermissionsEnum.DOCS_DELETE]) as PermissionsEnum[],
	manage: Object.freeze([PermissionsEnum.DOCS_MANAGE]) as PermissionsEnum[],
	review: Object.freeze([PermissionsEnum.DOCS_REVIEW]) as PermissionsEnum[],
	aiImport: Object.freeze([PermissionsEnum.DOCS_AI_IMPORT]) as PermissionsEnum[]
});

/** The shape components expose as `docsPermissions` for their templates. */
export type DocsPermissionGroups = typeof DOCS_PERMISSIONS;

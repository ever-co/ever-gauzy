// cspell:ignore inlines mjmlconfig
/**
 * The ONE place in @gauzy/core that is allowed to call the MJML compiler (an ESLint
 * `no-restricted-imports` rule in packages/core/eslint.config.js enforces it).
 *
 * Why a wrapper: with its defaults, mjml resolves `<mj-include path="..." type="mjml|html|css">`
 * against the process cwd and inlines the bytes of ANY file the API can read. Email and accounting
 * templates are tenant-editable, so a template (or a preview request) could read `/etc/passwd`,
 * `/proc/self/environ` or `.env` and get it back in the rendered HTML (GHSA-48h9-vwf5-h8m7).
 * No shipped template uses `mj-include`, so the feature is switched off for every compile.
 */
import * as mjml2html from 'mjml';

/**
 * Options passed to every MJML compile.
 *
 * - `ignoreIncludes: true` makes mjml-parser-xml drop `<mj-include>` before it resolves or reads
 *   the path (mjml-parser-xml 4.x, `if (ignoreIncludes || !isNode) return;`).
 * - `validationLevel: 'soft'` is the mjml default and what every call site used before; pinned so
 *   a future default cannot start rejecting templates that render today.
 * - `useMjmlConfigOptions: false`, and no `filePath` / `mjmlConfigPath`: never read a
 *   `.mjmlconfig` (which can register components and preprocessors) from the API cwd.
 */
export const SAFE_MJML_OPTIONS = Object.freeze({
	ignoreIncludes: true,
	validationLevel: 'soft' as const,
	useMjmlConfigOptions: false
});

/**
 * Shape of the mjml2html result the callers use.
 */
export interface ICompiledMjml {
	html: string;
	errors: unknown[];
}

/**
 * Coerces a template source to a string.
 *
 * Handlebars.compile() also accepts a pre-parsed AST object, which is a known code-injection
 * vector; request bodies are JSON, so an unvalidated `data` could be an object. Everything that
 * can reach Handlebars.compile() or mjml2html() from a request goes through this first.
 *
 * @param source - The template source as received.
 * @returns The source as a string (`''` for null/undefined).
 */
export function toTemplateSource(source: unknown): string {
	return typeof source === 'string' ? source : String(source ?? '');
}

/**
 * Compiles MJML to HTML with filesystem includes disabled.
 *
 * @param source - The MJML source.
 * @returns The mjml2html result (`html` and `errors`).
 */
export function compileMjml(source: unknown): ICompiledMjml {
	return mjml2html(toTemplateSource(source), { ...SAFE_MJML_OPTIONS });
}

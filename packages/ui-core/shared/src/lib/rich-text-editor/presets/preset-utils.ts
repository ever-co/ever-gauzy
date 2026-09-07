import { StarterKit } from '@tiptap/starter-kit';
import { Image } from '@tiptap/extension-image';

/**
 * Shared Link configuration (05-editor-spec.md §3.3): links never navigate on click
 * inside the editor, plain URLs auto-link, and every link carries the hardened rel.
 * `target` is preserved through the extension's attribute passthrough so legacy
 * `<a target>` markup round-trips (§3.6).
 */
export const baseLinkConfiguration = {
	openOnClick: false,
	autolink: true,
	HTMLAttributes: {
		rel: 'noopener noreferrer nofollow'
	}
};

/**
 * StarterKit option keys are the camelCase extension names (including the bundled
 * utility extensions `placeholder` / `characterCount` — 05-editor-spec.md §2.1:
 * "all individually configurable ... configured, not re-installed"). Typed loosely
 * here so preset factories can pass those utility keys without chasing the exact
 * option interface across 3.x minors; the values themselves follow the documented
 * v3 option shapes.
 */
export function configureStarterKit(options: Record<string, unknown>): ReturnType<typeof StarterKit.configure> {
	return StarterKit.configure(options as unknown as Parameters<typeof StarterKit.configure>[0]);
}

/**
 * Image extended with `width`/`height` attributes so legacy CKEditor
 * `<img src alt width height>` markup round-trips losslessly (05-editor-spec.md §3.6).
 * Render-only — upload wiring is caller-provided and out of tier-1 scope.
 */
export const LegacyImage = Image.extend({
	addAttributes() {
		return {
			...this.parent?.(),
			width: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute('width'),
				renderHTML: (attributes: Record<string, unknown>) =>
					attributes['width'] ? { width: attributes['width'] } : {}
			},
			height: {
				default: null,
				parseHTML: (element: HTMLElement) => element.getAttribute('height'),
				renderHTML: (attributes: Record<string, unknown>) =>
					attributes['height'] ? { height: attributes['height'] } : {}
			}
		};
	}
});

/**
 * Email-safe image: same attribute surface as {@link LegacyImage} but only parses
 * absolute `http(s)` sources — relative/blob/data URLs do not survive into an email
 * body (05-editor-spec.md §3.3, `email` preset "absolute URLs only").
 */
export const AbsoluteUrlImage = LegacyImage.extend({
	parseHTML() {
		return [
			{
				tag: 'img[src]',
				getAttrs: (element: HTMLElement | string) => {
					if (typeof element === 'string') {
						return false;
					}
					const src = element.getAttribute('src') || '';
					return /^https?:\/\//i.test(src) ? null : false;
				}
			}
		];
	}
});

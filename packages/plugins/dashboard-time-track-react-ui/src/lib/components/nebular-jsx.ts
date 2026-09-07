/**
 * JSX typings for the Nebular hooks this dashboard leans on so its markup is styled by the SAME
 * global stylesheet as the Angular tab:
 *
 * - `<nb-card>`, `<nb-card-header>`, `<nb-card-body>`, `<nb-list>`, `<nb-list-item>`, `<nb-icon>`
 *   are rendered as plain custom elements (React never upgrades them, Angular never sees them).
 *   Nebular emits its card/list/icon THEME rules against these tag names globally
 *   (`@nebular/theme/components/{card,list,icon}/_*.theme.scss`), and so do the Gauzy overrides
 *   (`packages/ui-core/static/styles/_overrides.scss`, `gauzy/_gauzy-cards.scss`), so paddings,
 *   colours, dividers and the density metrics match without copying a single value. Only the
 *   components' encapsulated `:host` layout rules are missing; `styles.ts` re-declares those.
 * - `nbbutton=""` — Nebular's button theme is emitted with `[nbButton]` attribute selectors
 *   (`@nebular/theme/components/button/_button.component.theme.scss`); an HTML attribute
 *   selector is case-insensitive, so `nbbutton` on a `<button>` opts it into the exact
 *   filled/outline/ghost looks, sizes and statuses of `[nbButton]`.
 *
 * A plain `.ts` module (not a `.d.ts`) imported for its side effect: ng-packagr only compiles
 * files reachable from the entry point, so an unreferenced declaration file would be invisible
 * to the library build.
 */
import 'react';

export {};

declare module 'react' {
	interface HTMLAttributes<T> {
		/** Opts a `<button>` into Nebular's global `[nbButton]` styles. */
		nbbutton?: '';
	}

	namespace JSX {
		type NbElementProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;

		interface IntrinsicElements {
			'nb-icon': NbElementProps & { icon?: string };
			'nb-card': NbElementProps;
			'nb-card-header': NbElementProps;
			'nb-card-body': NbElementProps;
			'nb-list': NbElementProps;
			'nb-list-item': NbElementProps;
		}
	}
}

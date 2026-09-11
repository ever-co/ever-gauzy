import { Component } from '@angular/core';

@Component({
    selector: 'ga-inventory-layout-selector',
    template: `<div class="content"><router-outlet></router-outlet></div>`,
    styles: [
        `
			/* ── Passing the column's height through ──────────────────────────
			   This component is the /pages/organization/inventory shell: its whole
			   template is one wrapper around a router-outlet, and the items table,
			   the item form and the item view render into it.

			   styles/_overrides.scss hands the routed page the viewport-bounded
			   height the content column already has — but with
			   "nb-layout-column > router-outlet + *", a DIRECT-child selector, so on
			   a nested route it lands on THIS component and stops. Below it the page
			   had no definite height for nb-card's "height: 100%" to resolve against,
			   the card collapsed to its content, and the table inside it came out
			   short of the card — which is what made its scrollbar short too.

			   WHY NOT ":host { display: flex }", which is the obvious way to hand a
			   flex height on: it cannot win. pages.component.scss carries
			   ":host ::ng-deep router-outlet + * { display: block }", which shims to
			   "[_nghost-pages] router-outlet + *" — (0,1,1) — and reaches EVERY routed
			   component in the app, this one included. A component's own ":host" is
			   "[_nghost-x]", (0,1,0), and loses. So the host here stays "display:
			   block" whatever this file says, and a "flex: 1 1 auto" on the wrapper
			   would have nothing to grow inside.

			   What the host DOES get from that same _overrides rule is "flex: 1 1
			   auto" — a different property, so nothing overrides it — which makes its
			   own height definite. So the wrapper takes 100% of it rather than trying
			   to be a flex child of a box that is not a flex container, and the
			   routed page grows inside the wrapper, which IS one. */
			:host {
				/* Releases the automatic minimum size (a flex item refuses to shrink
				   below its content), so the page fits the column instead of driving
				   it. Deliberately no "display" here: see the note above. */
				min-height: 0;
				min-width: 0;
			}

			.content {
				height: 100%;
				display: flex;
				flex-direction: column;
				min-height: 0;
				min-width: 0;
			}

			/* ::ng-deep is required and is not a leak: the routed component is a
			   SIBLING of the router-outlet in the DOM but belongs to a different
			   component, so it carries none of this template's _ngcontent attribute
			   and a plain "router-outlet + *" would shim to a selector matching
			   nothing. Leading with :host keeps the rule inside this shell.

			   This sets no "display", so it neither fights nor is fought by the
			   pages.component rule above — "flex" and "min-height" are ours alone. */
			:host ::ng-deep router-outlet {
				display: none;
			}

			:host ::ng-deep router-outlet + * {
				flex: 1 1 auto;
				min-height: 0;
				min-width: 0;
				max-width: 100%;
			}
		`
    ],
    standalone: false
})
export class InventoryComponent {}

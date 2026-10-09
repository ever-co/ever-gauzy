/**
 * The marker class every entity selector's dropdown panel carries.
 */
const ENTITY_SELECT_CLASS = 'gauzy-entity-select';

/**
 * Build the class list ng-select puts on an APPENDED dropdown panel.
 *
 * `appendTo="body"` moves the panel out of the selector's own DOM, so the only handle a
 * stylesheet has on it is the class ng-select copies across when it appends it:
 *
 *   [class]="appendToValue ? (ngClass() ? ngClass() : classes) : null"
 *
 * `classes` there is the element's STATIC class attribute, captured once via
 * `HostAttributeToken('class')` — a `[class.x]` binding never reaches the panel. Setting
 * `ngClass` REPLACES that fallback, which is why the result rebuilds the base classes rather
 * than adding to them, and why `null` is returned when there is nothing extra to add: that
 * leaves ng-select on its own fallback, i.e. exactly the static `class` attribute.
 *
 * The header passes `header-entity-select` so its panels can be set in the header band's text;
 * see `.ng-dropdown-panel.header-entity-select` in `_overrides.scss`.
 *
 * @param dropdownClass Extra class(es) requested by the host of the selector.
 * @param extraClasses Static class(es) the selector's own element carries beyond the marker one
 * (e.g. `organization-entity-select`), which the rebuilt list has to keep.
 * @returns The panel class list, or `null` to leave ng-select on its static-attribute fallback.
 */
export function entitySelectPanelClass(dropdownClass: string, ...extraClasses: string[]): string | null {
	if (!dropdownClass) {
		return null;
	}
	return [ENTITY_SELECT_CLASS, ...extraClasses, dropdownClass].join(' ');
}

/**
 * `@gauzy/ui-core/i18n` is a barrel over the whole app i18n module; the filter bar only
 * needs `TranslationBaseComponent` to exist so the class can be constructed directly.
 */
jest.mock('@gauzy/ui-core/i18n', () => ({
	TranslationBaseComponent: class {
		constructor(public readonly translateService: unknown) {}
		getTranslation(key: string): string {
			return key;
		}
	}
}));

import { DocumentKindEnum } from '@gauzy/contracts';
import { createInitialDocsFilterState, DocsFilterState } from '../../models/docs-filter.model';
import { DocsFilterBarComponent } from './docs-filter-bar.component';

/**
 * Clear all resets the search scope to names, so content search on its own is
 * something to clear — even though the shared `hasActiveFilters` predicate (which
 * drives the empty state) deliberately ignores `searchIn`.
 */
describe('DocsFilterBarComponent — Clear all visibility', () => {
	const bar = (patch: Partial<DocsFilterState> = {}) => {
		const component = new DocsFilterBarComponent({} as never);
		component.value = { ...createInitialDocsFilterState(), ...patch };
		return component;
	};

	it('is hidden for the default state', () => {
		expect(bar().hasActiveFilters).toBe(false);
	});

	it('shows when content search is the only active option', () => {
		expect(bar({ searchIn: 'content' }).hasActiveFilters).toBe(true);
	});

	it('stays hidden for name search with nothing else set', () => {
		expect(bar({ searchIn: 'name' }).hasActiveFilters).toBe(false);
	});

	it('still shows for an ordinary filter', () => {
		expect(bar({ kind: [DocumentKindEnum.FILE] }).hasActiveFilters).toBe(true);
	});

	it('is hidden while the filter state has not arrived', () => {
		const component = new DocsFilterBarComponent({} as never);
		component.value = null;
		expect(component.hasActiveFilters).toBe(false);
	});
});

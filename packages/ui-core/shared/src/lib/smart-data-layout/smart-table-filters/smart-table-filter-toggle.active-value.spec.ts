import { filterRowHasActiveValue } from './smart-table-filter-toggle.directive';

/**
 * The toggle's active-filter dot. ng-select marks a value on its inner container, not on the host, so
 * the dot never lit for an ng-select filter (review R6, package-update follow-up).
 */
describe('filterRowHasActiveValue', () => {
	const row = (html: string) => {
		const element = document.createElement('div');
		element.innerHTML = html;
		return element;
	};

	/** The DOM ng-select renders: the host, and `ng-has-value` on its container when a value is set. */
	const ngSelect = (hasValue: boolean) =>
		`<ng-select class="ng-select"><div class="ng-select-container${hasValue ? ' ng-has-value' : ''}"></div></ng-select>`;

	it('lights for an ng-select that holds a value', () => {
		expect(filterRowHasActiveValue(row(ngSelect(true)))).toBe(true);
	});

	it('stays dark for an empty ng-select', () => {
		expect(filterRowHasActiveValue(row(ngSelect(false)))).toBe(false);
	});

	it('still reads text inputs, native selects, nb-select and the accept/deny toggle', () => {
		const typed = row('<input />');
		(typed.querySelector('input') as HTMLInputElement).value = 'abc';
		expect(filterRowHasActiveValue(typed)).toBe(true);
		expect(filterRowHasActiveValue(row('<nb-select><button class="select-button placeholder"></button></nb-select>'))).toBe(false);
		expect(filterRowHasActiveValue(row('<nb-select><button class="select-button"></button></nb-select>'))).toBe(true);
		expect(filterRowHasActiveValue(row('<button class="na on"></button>'))).toBe(false);
		expect(filterRowHasActiveValue(row('<button class="deny on"></button>'))).toBe(true);
	});
});

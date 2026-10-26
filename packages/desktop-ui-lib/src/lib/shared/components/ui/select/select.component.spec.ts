import { OverlayContainer } from '@angular/cdk/overlay';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgSelectComponent } from '@ng-select/ng-select';
import { Subject } from 'rxjs';
import { SelectComponent } from './select.component';

describe('SelectComponent', () => {
	let component: SelectComponent;
	let fixture: ComponentFixture<SelectComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SelectComponent],
			// Nebular's overlay container needs an <nb-layout>; the CDK's own is enough to open a panel here.
			providers: [{ provide: OverlayContainer, useClass: OverlayContainer }]
		}).compileComponents();
		fixture = TestBed.createComponent(SelectComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	/**
	 * The desktop task / project / client / team selectors reload their list from `[typeahead]` only.
	 * ng-select 21 pushed `null` into it whenever a typed search ended (close, select, clear);
	 * ng-select 24 stopped, so the next opening kept showing the last search's results under an
	 * empty search box. The component restores the old emissions.
	 */
	describe('typeahead reset after a search (ng-select 24)', () => {
		let typeahead: Subject<string>;
		let emitted: Array<string | null>;
		let ngSelect: NgSelectComponent;

		beforeEach(() => {
			typeahead = new Subject<string>();
			emitted = [];
			typeahead.subscribe((term) => emitted.push(term));
			fixture.componentRef.setInput('typeahead', typeahead);
			fixture.componentRef.setInput('items', [
				{ id: '1', name: 'Alpha' },
				{ id: '2', name: 'Beta' }
			]);
			fixture.componentRef.setInput('bindLabel', 'name');
			fixture.componentRef.setInput('bindValue', 'id');
			fixture.detectChanges();
			ngSelect = fixture.debugElement.query(By.directive(NgSelectComponent)).componentInstance;
		});

		afterEach(() => typeahead.complete());

		it('emits null when the panel closes after a typed search', () => {
			ngSelect.open();
			ngSelect.filter('alp');
			ngSelect.close();

			expect(emitted).toEqual(['alp', null]);
		});

		it('emits null when an option is picked from a typed search (picking closes the panel)', () => {
			ngSelect.open();
			ngSelect.filter('alp');
			ngSelect.select(ngSelect.itemsList.items[0]);

			expect(emitted).toEqual(['alp', null]);
		});

		it('emits null when the selection is cleared after a typed search', () => {
			ngSelect.open();
			ngSelect.filter('alp');
			ngSelect.handleClearClick(new MouseEvent('click'));

			expect(emitted[0]).toBe('alp');
			expect(emitted).toContain(null);
			expect(emitted.filter((term) => term === null)).toHaveLength(1);
		});

		it('emits nothing when the panel opens and closes without a search, as ng-select 21 did', () => {
			ngSelect.open();
			ngSelect.close();

			expect(emitted).toEqual([]);
		});

		it('emits nothing more once the typed search was erased by hand', () => {
			ngSelect.open();
			ngSelect.filter('alp');
			ngSelect.filter('');
			ngSelect.close();

			expect(emitted).toEqual(['alp', '']);
		});
	});
});

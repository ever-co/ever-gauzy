import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule } from '@ngx-translate/core';
import { InviteStatusEnum } from '@gauzy/contracts';
import { ListFilterStateService } from '@gauzy/ui-core/core';
import { InviteStatusFilterComponent } from './invite-status-filter.component';
import { RangeFilterComponent } from './range-filter.component';
import { ToggleFilterComponent } from './toggle-filter/toggle-filter.component';

/**
 * The filters as a list renders them: a column with a `filterFunction`, and the service answering what the user left
 * when they opened the row.
 */
describe('column filters restored by Back', () => {
	const filterFunction = jest.fn();
	let saved: Record<string, unknown>;
	const listFilterState = {
		restore: jest.fn((id: string) => saved[id]),
		record: jest.fn()
	};

	function mount<T extends { column: unknown; debounceTime: number }>(type: new () => T): ComponentFixture<T> {
		const fixture = TestBed.createComponent(type);
		fixture.componentInstance.column = { id: 'col', filterFunction };
		fixture.componentInstance.debounceTime = 10;
		fixture.detectChanges();
		return fixture;
	}

	beforeEach(() => {
		saved = {};
		filterFunction.mockReset();
		listFilterState.record.mockReset();
		TestBed.configureTestingModule({
			declarations: [InviteStatusFilterComponent, RangeFilterComponent, ToggleFilterComponent],
			imports: [FormsModule, ReactiveFormsModule, NgSelectModule, TranslateModule.forRoot()],
			providers: [{ provide: ListFilterStateService, useValue: listFilterState }],
			schemas: [NO_ERRORS_SCHEMA]
		});
	});

	describe('invite status (a select)', () => {
		it('shows the status the user left and filters the list by it', async () => {
			saved['col'] = InviteStatusEnum.ACCEPTED;

			const fixture = mount(InviteStatusFilterComponent);
			await fixture.whenStable();
			fixture.detectChanges();

			expect(filterFunction).toHaveBeenCalledWith(InviteStatusEnum.ACCEPTED, 'col');
			expect(fixture.nativeElement.querySelector('.ng-value-label')?.textContent).toContain(
				InviteStatusEnum.ACCEPTED
			);
		});

		it('shows no status when the list is not restored', async () => {
			const fixture = mount(InviteStatusFilterComponent);
			await fixture.whenStable();
			fixture.detectChanges();

			expect(filterFunction).not.toHaveBeenCalled();
			expect(fixture.nativeElement.querySelector('.ng-value-label')).toBeNull();
		});

		it('records a choice and a cleared choice', () => {
			const fixture = mount(InviteStatusFilterComponent);

			fixture.componentInstance.onChange(InviteStatusEnum.INVITED);
			fixture.componentInstance.onChange(undefined);

			expect(listFilterState.record).toHaveBeenNthCalledWith(1, 'col', InviteStatusEnum.INVITED);
			expect(listFilterState.record).toHaveBeenNthCalledWith(2, 'col', null);
			expect(filterFunction).toHaveBeenLastCalledWith(null, 'col');
		});
	});

	describe('range', () => {
		it('shows the range the user left and filters the list by it', fakeAsync(() => {
			saved['col'] = { min: 5, max: 20 };

			const fixture = mount(RangeFilterComponent);
			tick(10);

			expect(fixture.componentInstance.rangeControl.value).toEqual({ min: 5, max: 20 });
			expect(filterFunction).toHaveBeenCalledWith({ min: 5, max: 20 }, 'col');
			fixture.destroy();
		}));

		it('records a typed range', fakeAsync(() => {
			const fixture = mount(RangeFilterComponent);

			fixture.componentInstance.rangeControl.setValue({ min: 1, max: 3 });
			tick(10);

			expect(listFilterState.record).toHaveBeenCalledWith('col', { min: 1, max: 3 });
			fixture.destroy();
		}));
	});

	describe('toggle', () => {
		it.each([
			[true, 'accept'],
			[false, 'deny']
		])('puts the toggle back to %s and filters the list by it', (value, choice) => {
			saved['col'] = value;

			const fixture = mount(ToggleFilterComponent);

			expect(fixture.componentInstance.choice).toBe(choice);
			expect(filterFunction).toHaveBeenCalledWith(value, 'col');
		});

		it('leaves the toggle alone when nothing was chosen', () => {
			const fixture = mount(ToggleFilterComponent);

			expect(fixture.componentInstance.choice).toBeUndefined();
			expect(filterFunction).not.toHaveBeenCalled();
		});
	});
});

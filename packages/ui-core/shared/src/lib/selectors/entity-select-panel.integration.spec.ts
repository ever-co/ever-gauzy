import { Component, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { FlexibleConnectedPositionStrategy } from '@angular/cdk/overlay';
import { NgSelectComponent, NgSelectModule } from '@ng-select/ng-select';
import { ENTITY_SELECT_PANEL_POSITIONS, EntitySelectPanelDirective } from './entity-select-panel.directive';
import { NG_SELECT_TRIGGER_WIDTH_VAR, NgSelectPanelSizingService } from './ng-select-panel-sizing.service';

/**
 * The same two pieces against the REAL ng-select, so the details they rely on are pinned rather than
 * assumed: the panel rendered inside a `.cdk-overlay-pane`, the listbox id the open input names in
 * `aria-controls`, `open` firing before the overlay attaches, and the protected `dropdownOverlayRef`
 * holding a `FlexibleConnectedPositionStrategy`. A future ng-select that changes any of them fails here.
 */
@Component({
	standalone: true,
	imports: [NgSelectModule, FormsModule, EntitySelectPanelDirective],
	template: `
		<ng-select
			#select
			class="gauzy-entity-select"
			[items]="items"
			bindLabel="name"
			[(ngModel)]="selected"
			appendTo="body"
		></ng-select>
	`
})
class HostComponent {
	@ViewChild('select', { static: true }) select!: NgSelectComponent;
	items = [{ name: 'Ever Technologies LTD' }, { name: 'A project with a rather long name indeed' }];
	selected = null;
}

describe('entity select panel (real ng-select)', () => {
	let fixture: ComponentFixture<HostComponent>;
	let sizing: NgSelectPanelSizingService;
	let withPositions: jest.SpyInstance;

	const flush = async () => {
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
		fixture.detectChanges();
	};

	beforeEach(async () => {
		withPositions = jest.spyOn(FlexibleConnectedPositionStrategy.prototype, 'withPositions');
		await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
		sizing = TestBed.inject(NgSelectPanelSizingService);
		sizing.start();
		fixture = TestBed.createComponent(HostComponent);
		fixture.detectChanges();
		// jsdom lays nothing out: give the trigger the header pill's measured width.
		jest.spyOn(fixture.componentInstance.select.element, 'getBoundingClientRect').mockReturnValue({ width: 52 } as DOMRect);
	});

	afterEach(() => {
		fixture.componentInstance.select.close();
		fixture.destroy();
		sizing.ngOnDestroy();
		withPositions.mockRestore();
	});

	it('renders the panel in a CDK pane that carries the trigger width', async () => {
		fixture.componentInstance.select.open();
		fixture.detectChanges();
		await flush();

		const panel = document.querySelector('.cdk-overlay-pane > ng-dropdown-panel.gauzy-entity-select');
		expect(panel).not.toBeNull();
		expect((panel!.parentElement as HTMLElement).style.getPropertyValue(NG_SELECT_TRIGGER_WIDTH_VAR)).toBe('52px');
	});

	it('gives the open panel the end-aligned fallbacks', async () => {
		fixture.componentInstance.select.open();
		fixture.detectChanges();
		await flush();

		expect(withPositions).toHaveBeenLastCalledWith(ENTITY_SELECT_PANEL_POSITIONS);
	});
});

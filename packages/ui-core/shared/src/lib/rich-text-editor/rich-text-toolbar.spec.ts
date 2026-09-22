import { ChangeDetectorRef, ElementRef, NgZone } from '@angular/core';
import { RichTextToolbarComponent } from './rich-text-toolbar.component';

/**
 * Roving-tabindex tests for the shared rich-text toolbar (05-editor-spec.md §13 / §3.10).
 *
 * The component is driven directly against a hand-built DOM instead of through `TestBed`: the
 * behaviour under test is pure DOM bookkeeping, and the real template needs Nebular, TipTap and
 * the translate pipe to render. The fixture below mirrors the parts of the template the selector
 * actually keys on — `.rich-text-toolbar` rows, `.rich-text-toolbar__group` clusters, the
 * `nb-select` trigger, and a popover whose controls must stay OUT of the ring.
 */
const FIXTURE = `
	<div class="rich-text-toolbar" role="toolbar">
		<div class="rich-text-toolbar__group">
			<button id="undo" type="button"></button>
			<button id="redo" type="button" disabled></button>
		</div>
		<div class="rich-text-toolbar__group rich-text-toolbar__group--select">
			<nb-select><button id="block-format" type="button"></button></nb-select>
		</div>
		<div class="rich-text-toolbar__group rich-text-toolbar__group--popover-host">
			<button id="link" type="button"></button>
			<div class="rich-text-toolbar__popover">
				<input id="link-url" type="url" />
				<button id="link-apply" type="button"></button>
			</div>
		</div>
	</div>
	<div class="rich-text-toolbar rich-text-toolbar--table-ops" role="toolbar">
		<div class="rich-text-toolbar__group">
			<button id="row-above" type="button"></button>
			<button id="row-below" type="button"></button>
		</div>
	</div>
`;

function createComponent() {
	const host = document.createElement('div');
	host.innerHTML = FIXTURE;
	document.body.appendChild(host);

	const zone = { run: (fn: () => unknown) => fn() } as unknown as NgZone;
	const cdr = { markForCheck: jest.fn(), detectChanges: jest.fn() } as unknown as ChangeDetectorRef;

	const component = new RichTextToolbarComponent(zone, cdr, new ElementRef(host));
	component.ngAfterViewChecked();

	const byId = (id: string) => host.querySelector<HTMLElement>(`#${id}`);
	return { component, host, byId };
}

/** Dispatches a real keyboard event so `defaultPrevented` is observable. */
function press(target: HTMLElement, key: string): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
	Object.defineProperty(event, 'target', { value: target });
	return event;
}

describe('RichTextToolbarComponent — roving tabindex', () => {
	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('leaves exactly one tab stop per toolbar row', () => {
		const { byId } = createComponent();

		expect(byId('undo').tabIndex).toBe(0);
		expect(byId('block-format').tabIndex).toBe(-1);
		expect(byId('link').tabIndex).toBe(-1);
		// The contextual table row is its own widget with its own single stop.
		expect(byId('row-above').tabIndex).toBe(0);
		expect(byId('row-below').tabIndex).toBe(-1);
	});

	it('keeps popover controls out of the ring so they keep their native tab order', () => {
		const { byId } = createComponent();

		expect(byId('link-apply').tabIndex).toBe(0);
		expect(byId('link-url').tabIndex).toBe(0);
	});

	it('moves the tab stop with ArrowRight and includes the nb-select trigger', () => {
		const { component, byId } = createComponent();

		component.onToolbarKeydown(press(byId('undo'), 'ArrowRight'));

		expect(byId('undo').tabIndex).toBe(-1);
		expect(byId('block-format').tabIndex).toBe(0);
		expect(document.activeElement).toBe(byId('block-format'));
	});

	it('wraps backwards from the first control to the last', () => {
		const { component, byId } = createComponent();

		component.onToolbarKeydown(press(byId('undo'), 'ArrowLeft'));

		expect(byId('link').tabIndex).toBe(0);
		expect(document.activeElement).toBe(byId('link'));
	});

	it('skips disabled controls — they cannot take focus', () => {
		const { component, byId } = createComponent();

		component.onToolbarKeydown(press(byId('undo'), 'ArrowRight'));

		expect(byId('redo').tabIndex).not.toBe(0);
		expect(document.activeElement).not.toBe(byId('redo'));
	});

	it('jumps to the ends with Home / End and swallows the key so the page does not scroll', () => {
		const { component, byId } = createComponent();

		const end = press(byId('undo'), 'End');
		component.onToolbarKeydown(end);
		expect(document.activeElement).toBe(byId('link'));
		expect(end.defaultPrevented).toBe(true);

		const home = press(byId('link'), 'Home');
		component.onToolbarKeydown(home);
		expect(document.activeElement).toBe(byId('undo'));
		expect(home.defaultPrevented).toBe(true);
	});

	it('ignores arrow keys pressed inside a popover input', () => {
		const { component, byId } = createComponent();

		const event = press(byId('link-url'), 'ArrowRight');
		component.onToolbarKeydown(event);

		expect(event.defaultPrevented).toBe(false);
		expect(byId('undo').tabIndex).toBe(0);
	});

	it('never intercepts Tab, so focus can still leave the toolbar for the editor body', () => {
		const { component, byId } = createComponent();

		const event = press(byId('undo'), 'Tab');
		component.onToolbarKeydown(event);

		expect(event.defaultPrevented).toBe(false);
	});

	it('adopts a clicked control as the row tab stop', () => {
		const { component, byId } = createComponent();

		const focusEvent = new FocusEvent('focusin', { bubbles: true });
		Object.defineProperty(focusEvent, 'target', { value: byId('link') });
		component.onToolbarFocusIn(focusEvent);

		expect(byId('link').tabIndex).toBe(0);
		expect(byId('undo').tabIndex).toBe(-1);
	});

	it('re-homes the tab stop when the active control disappears', () => {
		const { component, host, byId } = createComponent();

		component.onToolbarKeydown(press(byId('undo'), 'End'));
		expect(byId('link').tabIndex).toBe(0);

		// The `insert` cluster is behind an *ngIf — a preset without it drops the whole group.
		host.querySelector('.rich-text-toolbar__group--popover-host').remove();
		component.ngAfterViewChecked();

		expect(byId('block-format').tabIndex).toBe(0);
		expect(byId('undo').tabIndex).toBe(-1);
	});

	it('does not react to controls outside this component', () => {
		const { component } = createComponent();
		const outside = document.createElement('button');
		document.body.appendChild(outside);

		const event = press(outside, 'ArrowRight');
		component.onToolbarKeydown(event);

		expect(event.defaultPrevented).toBe(false);
	});
});

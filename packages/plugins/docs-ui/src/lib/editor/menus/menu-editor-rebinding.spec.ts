/**
 * `SuggestionHostService` is only ever a DI token for the text bubble menu, but importing
 * it drags in the CDK overlay and the whole suggestion-list component. Stub the module so
 * these tests exercise the menu classes alone.
 */
jest.mock('../suggestion/suggestion-host.service', () => ({
	SuggestionHostService: class {
		public isOpen = false;
	}
}));

import {
	ChangeDetectionStrategy,
	ChangeDetectorRef,
	Component,
	ElementRef,
	Injector,
	Input,
	NgZone,
	OnChanges,
	SimpleChange
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed, getTestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { SuggestionHostService } from '../suggestion/suggestion-host.service';
import { FloatingBlockMenuComponent } from './floating-block-menu.component';
import { TableBubbleMenuComponent } from './table-bubble-menu.component';
import { TextBubbleMenuComponent } from './text-bubble-menu.component';

/**
 * Editor menu re-binding (spec 05 §6.5 / §6.7).
 *
 * `DocumentEditorComponent.rebuildEditor()` swaps the `Editor` instance **synchronously**
 * (`teardownEditor()` immediately followed by `createEditor()`), so the `*ngIf="editor"`
 * that wraps these three menus never observes a falsy value: the embedded view is kept and
 * only the `[editor]` binding changes. Registering the ProseMirror plugin in
 * `ngAfterViewInit` alone therefore left every menu bound to the destroyed editor after
 * navigating from one page document to another — the bubble menus, the table chrome and the
 * empty-line "+" all silently stopped working.
 */

interface IFakeEditor {
	registerPlugin: jest.Mock;
	unregisterPlugin: jest.Mock;
	on: jest.Mock;
	off: jest.Mock;
	destroy: jest.Mock;
	isDestroyed: boolean;
	isEditable: boolean;
}

/**
 * The menus only ever call `registerPlugin` / `unregisterPlugin` / `on` / `off` on the
 * editor, and neither `BubbleMenuPlugin` nor `FloatingMenuPlugin` touches it until
 * ProseMirror instantiates the plugin view — so a real TipTap editor (30+ extensions,
 * a live DOM) buys nothing here.
 */
const fakeEditor = (): IFakeEditor => {
	const editor: IFakeEditor = {
		registerPlugin: jest.fn(),
		unregisterPlugin: jest.fn(),
		on: jest.fn(),
		off: jest.fn(),
		destroy: jest.fn(() => {
			editor.isDestroyed = true;
		}),
		isDestroyed: false,
		isEditable: true
	};
	return editor;
};

const asEditor = (editor: IFakeEditor): Editor => editor as unknown as Editor;

/** The ProseMirror plugin key a `registerPlugin` / `unregisterPlugin` call carried. */
const registeredKey = (editor: IFakeEditor, call = 0): string =>
	(editor.registerPlugin.mock.calls[call][0] as Plugin).key;
const unregisteredKey = (editor: IFakeEditor, call = 0): string =>
	(editor.unregisterPlugin.mock.calls[call][0] as PluginKey).key;

const listenerFor = (mock: jest.Mock, event: string): unknown =>
	mock.mock.calls.find((call) => call[0] === event)?.[1];

/** The menus only hop through the zone to mark for check — run straight through. */
const zone = {
	run: <T>(fn: () => T): T => fn(),
	runOutsideAngular: <T>(fn: () => T): T => fn()
} as unknown as NgZone;

interface IMenuComponent extends OnChanges {
	editor: Editor;
	menuRef: ElementRef<HTMLElement>;
	ngAfterViewInit(): void;
	ngOnDestroy(): void;
}

/** Builds a menu component outside `TestBed` — `inject()` needs an injection context only. */
const build = <T>(type: new () => T, extraProviders: unknown[] = []): T => {
	const injector = Injector.create({
		providers: [
			{ provide: ChangeDetectorRef, useValue: { markForCheck: jest.fn() } },
			{ provide: NgZone, useValue: zone },
			...(extraProviders as never[]),
			{ provide: type, useClass: type, deps: [] }
		]
	});
	const component = injector.get(type) as T & IMenuComponent;
	component.menuRef = new ElementRef(document.createElement('div'));
	return component;
};

const menus: { name: string; create: () => IMenuComponent; listens: string[] }[] = [
	{
		name: 'TextBubbleMenuComponent',
		create: () =>
			build(TextBubbleMenuComponent, [
				{ provide: SuggestionHostService, useValue: { isOpen: false } }
			]) as unknown as IMenuComponent,
		listens: ['transaction', 'selectionUpdate']
	},
	{
		name: 'TableBubbleMenuComponent',
		create: () => build(TableBubbleMenuComponent) as unknown as IMenuComponent,
		listens: ['transaction']
	},
	{
		name: 'FloatingBlockMenuComponent',
		create: () => build(FloatingBlockMenuComponent) as unknown as IMenuComponent,
		listens: []
	}
];

describe.each(menus)('$name — editor re-binding', ({ create, listens }) => {
	let component: IMenuComponent;
	let editorA: IFakeEditor;
	let editorB: IFakeEditor;

	/** What the parent does on a `page/:id` change: destroy, recreate, re-bind. */
	const swapEditor = (): void => {
		editorA.destroy();
		component.editor = asEditor(editorB);
		component.ngOnChanges({ editor: new SimpleChange(asEditor(editorA), asEditor(editorB), false) });
	};

	beforeEach(() => {
		component = create();
		editorA = fakeEditor();
		editorB = fakeEditor();
		component.editor = asEditor(editorA);
	});

	it('registers exactly once against the first editor', () => {
		component.ngAfterViewInit();

		expect(editorA.registerPlugin).toHaveBeenCalledTimes(1);
		listens.forEach((event) => expect(listenerFor(editorA.on, event)).toBeDefined());
	});

	it('does not register from the first `ngOnChanges` — the static view query may not be resolved yet', () => {
		component.ngOnChanges({ editor: new SimpleChange(undefined, asEditor(editorA), true) });
		expect(editorA.registerPlugin).not.toHaveBeenCalled();

		component.ngAfterViewInit();
		expect(editorA.registerPlugin).toHaveBeenCalledTimes(1);
	});

	it('re-registers against the new editor when the `editor` input changes', () => {
		component.ngAfterViewInit();
		swapEditor();

		// The whole point: the menu now drives the live editor, not the discarded one.
		expect(editorB.registerPlugin).toHaveBeenCalledTimes(1);
		expect(registeredKey(editorB)).toBe(registeredKey(editorA));
		// …and it did not register a second plugin on the editor it left behind.
		expect(editorA.registerPlugin).toHaveBeenCalledTimes(1);
	});

	it('moves its editor event listeners over to the new instance', () => {
		component.ngAfterViewInit();
		swapEditor();

		listens.forEach((event) => {
			const handler = listenerFor(editorA.on, event);
			expect(editorA.off).toHaveBeenCalledWith(event, handler);
			expect(listenerFor(editorB.on, event)).toBe(handler);
		});
	});

	it('unregisters from the previous editor when that editor is still alive', () => {
		component.ngAfterViewInit();

		// A swap that leaves the old editor alive (it is not the rebuild path, but the
		// registration must not survive it either).
		component.editor = asEditor(editorB);
		component.ngOnChanges({ editor: new SimpleChange(asEditor(editorA), asEditor(editorB), false) });

		expect(editorA.unregisterPlugin).toHaveBeenCalledTimes(1);
		expect(unregisteredKey(editorA)).toBe(registeredKey(editorA));
	});

	it('skips `unregisterPlugin` on an already-destroyed editor but still re-registers', () => {
		component.ngAfterViewInit();
		swapEditor();

		// `rebuildEditor()` destroys the old editor first; reconfiguring its dead state
		// would achieve nothing (TipTap no-ops it too).
		expect(editorA.unregisterPlugin).not.toHaveBeenCalled();
		expect(editorB.registerPlugin).toHaveBeenCalledTimes(1);
	});

	it('tears down the current registration on destroy, and only that one', () => {
		component.ngAfterViewInit();
		swapEditor();
		component.ngOnDestroy();

		expect(editorB.unregisterPlugin).toHaveBeenCalledTimes(1);
		expect(unregisteredKey(editorB)).toBe(registeredKey(editorB));
		listens.forEach((event) => expect(editorB.off).toHaveBeenCalledWith(event, listenerFor(editorB.on, event)));
		// The old editor was already released by the swap — never touched twice.
		expect(editorA.unregisterPlugin).not.toHaveBeenCalled();
	});

	it('is idempotent — a second destroy releases nothing further', () => {
		component.ngAfterViewInit();
		component.ngOnDestroy();
		component.ngOnDestroy();

		expect(editorA.unregisterPlugin).toHaveBeenCalledTimes(1);
	});
});

/**
 * The premise of the fix, exercised through real Angular change detection rather than
 * asserted: an `*ngIf` whose expression goes from one truthy `Editor` to another keeps its
 * embedded view (so `ngAfterViewInit` never runs again) and only pushes the new value
 * through the `[editor]` binding — which is precisely what `rebuildEditor()` produces.
 */
describe('a synchronous editor swap under `*ngIf` (the `rebuildEditor()` shape)', () => {
	/** Mirrors `DocumentEditorComponent`: OnPush, and rebuilds synchronously on input change. */
	@Component({
		selector: 'gz-rebuild-host',
		standalone: true,
		imports: [CommonModule, FloatingBlockMenuComponent],
		changeDetection: ChangeDetectionStrategy.OnPush,
		template: `
			<ng-container *ngIf="editor">
				<gz-floating-block-menu [editor]="editor"></gz-floating-block-menu>
			</ng-container>
		`
	})
	class RebuildHostComponent implements OnChanges {
		@Input() documentId!: string;

		public editor: Editor | null = null;
		public readonly editors: IFakeEditor[] = [];

		/** `rebuildEditor()`: teardown + create, with no change detection in between. */
		ngOnChanges(): void {
			this.editors.at(-1)?.destroy();
			const next = fakeEditor();
			this.editors.push(next);
			this.editor = asEditor(next);
		}
	}

	beforeAll(() => {
		// `test-setup.ts` calls `setupZoneTestEnv()`, but under this package's spec
		// tsconfig (`moduleResolution: bundler`) that setup file resolves a *different*
		// instance of `@angular/core/testing` than a `.spec.ts` does — so the `TestBed`
		// imported here starts with no environment at all and every `createComponent`
		// fails on a null base module. Initialise the instance this file actually uses.
		const bed = getTestBed() as unknown as { platform?: unknown };
		if (!bed.platform) getTestBed().initTestEnvironment([BrowserTestingModule], platformBrowserTesting());
	});

	beforeEach(() => {
		TestBed.configureTestingModule({ imports: [RebuildHostComponent] });
		// The Nebular chrome is irrelevant here; `#menu` is all the class needs.
		TestBed.overrideComponent(FloatingBlockMenuComponent, {
			set: { template: '<div #menu></div>', imports: [], styles: [] }
		});
	});

	it('keeps the same menu component instance and re-registers it on the new editor', () => {
		const fixture = TestBed.createComponent(RebuildHostComponent);
		fixture.componentRef.setInput('documentId', 'doc-1');
		fixture.detectChanges();

		const host = fixture.componentInstance;
		const menuBefore = fixture.debugElement.query(By.directive(FloatingBlockMenuComponent)).componentInstance;
		expect(host.editors).toHaveLength(1);
		expect(host.editors[0].registerPlugin).toHaveBeenCalledTimes(1);

		// Navigate to another page document.
		fixture.componentRef.setInput('documentId', 'doc-2');
		fixture.detectChanges();

		const menuAfter = fixture.debugElement.query(By.directive(FloatingBlockMenuComponent)).componentInstance;
		// The `*ngIf` never went falsy, so Angular reused the view — this is the reason
		// `ngAfterViewInit` alone could not have re-registered anything.
		expect(menuAfter).toBe(menuBefore);
		expect(host.editors).toHaveLength(2);
		expect(host.editors[1].registerPlugin).toHaveBeenCalledTimes(1);
		expect(host.editors[0].registerPlugin).toHaveBeenCalledTimes(1);
	});
});

import '@angular/compiler';
import { COMPILER_OPTIONS, ChangeDetectionStrategy, Component, NgModule, provideZoneChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgSelectComponent, NgSelectModule } from '@ng-select/ng-select';

// The repo's shared setup initialises a DIFFERENT @angular/core/testing instance than the one
// this file imports, so initialise the environment from this module's own instance.
beforeAll(() => {
	const tb = getTestBed() as unknown as { platform: unknown; initTestEnvironment: (...a: unknown[]) => void };
	if (!tb.platform) {
		class ZoneTestModule {}
		NgModule({ providers: [provideZoneChangeDetection()] })(ZoneTestModule);
		tb.initTestEnvironment(
			[BrowserTestingModule, ZoneTestModule],
			platformBrowserTesting([{ provide: COMPILER_OPTIONS, useValue: {}, multi: true }]),
			{ errorOnUnknownElements: true, errorOnUnknownProperties: true }
		);
	}
});

const CUSTOM_MODEL = '__custom__';

const MODELS = [
	{ id: 'm-1', label: 'Model One' },
	{ id: 'm-2', label: 'Model Two' },
	{ id: 'm-3', label: 'Model Three' },
	{ id: 'm-4', label: 'Model Four' },
	{ id: 'm-5', label: 'Model Five' }
];

/**
 * Mirrors PR #9913's template EXACTLY: OnPush host, [items] bound to a METHOD CALL that
 * allocates a fresh array plus a fresh sentinel object on every evaluation, bindValue="id",
 * virtualScroll, searchable, clearable, control value '' (the branch's buildForms default).
 */
@Component({
	standalone: true,
	imports: [ReactiveFormsModule, NgSelectModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<form [formGroup]="form">
			<ng-select
				formControlName="defaultModel"
				bindValue="id"
				bindLabel="label"
				[items]="modelOptions()"
				[loading]="false"
				[clearable]="true"
				[searchable]="true"
				[virtualScroll]="true"
				placeholder="Provider default"
			>
				<ng-template ng-option-tmp let-model="item">
					<span class="model-label">{{ model.label }}</span>
					<span class="model-id">{{ model.id }}</span>
				</ng-template>
			</ng-select>
		</form>
	`
})
class FreshArrayHost {
	freshCalls = 0;
	form = new FormGroup({ defaultModel: new FormControl<string>('') });

	/** Verbatim shape of AiChatSettingsComponent.modelOptions(). */
	modelOptions() {
		this.freshCalls++;
		return [...MODELS, { id: CUSTOM_MODEL, label: 'Custom model…', providerId: 'openrouter' }];
	}
}

/** Control arm: identical, but the array reference is stable across CD passes. */
@Component({
	standalone: true,
	imports: [ReactiveFormsModule, NgSelectModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<form [formGroup]="form">
			<ng-select
				formControlName="defaultModel"
				bindValue="id"
				bindLabel="label"
				[items]="stable"
				[loading]="false"
				[clearable]="true"
				[searchable]="true"
				[virtualScroll]="true"
				placeholder="Provider default"
			></ng-select>
		</form>
	`
})
class StableArrayHost {
	freshCalls = 0;
	stable = [...MODELS, { id: CUSTOM_MODEL, label: 'Custom model…', providerId: 'openrouter' }];
	form = new FormGroup({ defaultModel: new FormControl<string>('') });
}

function selectOf(fixture: ComponentFixture<unknown>): NgSelectComponent {
	return fixture.debugElement.query((de) => de.componentInstance instanceof NgSelectComponent)
		.componentInstance as NgSelectComponent;
}

/** A REAL keydown on the ng-select host: goes through Angular's wrapListener -> markViewDirty. */
function pressKey(fixture: ComponentFixture<unknown>, key: string): void {
	const host: HTMLElement = fixture.nativeElement.querySelector('ng-select');
	host.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	// The CD pass the app performs after the listener returns.
	fixture.detectChanges();
}

async function boot(type: typeof FreshArrayHost | typeof StableArrayHost) {
	await TestBed.configureTestingModule({ imports: [type] }).compileComponents();
	const fixture = TestBed.createComponent(type);
	fixture.detectChanges();
	await fixture.whenStable();
	fixture.detectChanges();
	return fixture;
}

function run(fixture: ComponentFixture<FreshArrayHost | StableArrayHost>, label: string) {
	const select = selectOf(fixture);
	const host = fixture.componentInstance;

	// Open the way a user does: mousedown on the select container.
	const container: HTMLElement = fixture.nativeElement.querySelector('.ng-select-container');
	container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
	fixture.detectChanges();

	const trace = {
		arm: label,
		isOpen: select.isOpen(),
		itemsBindingEvalsAfterOpen: host.freshCalls,
		filteredLength: select.itemsList.filteredItems.length,
		markedAfterOpen: select.itemsList.markedIndex,
		markedAfterDown1: 0,
		markedAfterDown2: 0,
		itemsBindingEvalsAtEnd: 0,
		selectedValue: null as string | null,
		selectedLabel: null as string | null
	};

	pressKey(fixture, 'ArrowDown');
	trace.markedAfterDown1 = select.itemsList.markedIndex;
	pressKey(fixture, 'ArrowDown');
	trace.markedAfterDown2 = select.itemsList.markedIndex;
	pressKey(fixture, 'Enter');

	trace.itemsBindingEvalsAtEnd = host.freshCalls;
	trace.selectedValue = host.form.controls.defaultModel.value;
	trace.selectedLabel = select.selectedItems?.[0]?.label ?? null;

	// eslint-disable-next-line no-console
	console.log(JSON.stringify(trace, null, 2));
	return trace;
}

describe('PR #9913: keyboard navigation of the model dropdown', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('FRESH ARRAY (exactly what the branch binds): ArrowDown x2 + Enter picks the 3rd model', async () => {
		const trace = run(await boot(FreshArrayHost), 'fresh-array (branch)');
		expect(trace.isOpen).toBe(true);
		expect(trace.selectedValue).toBe('m-3');
	});

	it('STABLE ARRAY (control): ArrowDown x2 + Enter picks the 3rd model', async () => {
		const trace = run(await boot(StableArrayHost), 'stable-array (control)');
		expect(trace.isOpen).toBe(true);
		expect(trace.selectedValue).toBe('m-3');
	});

	it('FRESH ARRAY with a model ALREADY saved: ArrowUp above the selected row', async () => {
		const fixture = await boot(FreshArrayHost);
		fixture.componentInstance.form.controls.defaultModel.setValue('m-4');
		fixture.detectChanges();

		const select = selectOf(fixture);
		const container: HTMLElement = fixture.nativeElement.querySelector('.ng-select-container');
		container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
		fixture.detectChanges();

		const markedAfterOpen = select.itemsList.markedIndex; // expect 3 (m-4)
		pressKey(fixture, 'ArrowUp');
		const markedAfterUp1 = select.itemsList.markedIndex;
		pressKey(fixture, 'ArrowUp');
		const markedAfterUp2 = select.itemsList.markedIndex;
		pressKey(fixture, 'ArrowDown');
		const markedAfterDown = select.itemsList.markedIndex;
		pressKey(fixture, 'Enter');

		// eslint-disable-next-line no-console
		console.log(
			JSON.stringify(
				{
					arm: 'fresh-array, m-4 already selected',
					markedAfterOpen,
					markedAfterUp1,
					markedAfterUp2,
					markedAfterDown,
					selectedValue: fixture.componentInstance.form.controls.defaultModel.value
				},
				null,
				2
			)
		);
		expect(markedAfterUp2).toBe(1);
	});
});

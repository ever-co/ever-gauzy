import { Injector, runInInjectionContext } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { of } from 'rxjs';
import { docsUnsavedChangesGuard } from './docs-unsaved-changes.guard';

/**
 * Unsaved-changes guard (spec 04 §3.3, spec 05 §9.2).
 *
 * 🛑 The bug this closes: `page/:id` had no `canDeactivate` at all. Leaving fired a
 * fire-and-forget `void flush()` in `ngOnDestroy` while the autosave service's own
 * `ngOnDestroy` cleared the retry timer in the same teardown — a save that failed on the way
 * out was never retried and the user was never told. So the two behaviours that matter are:
 * leaving WAITS for the flush, and a flush that could not land ASKS before discarding.
 */
describe('docsUnsavedChangesGuard', () => {
	/** Minimal stand-in for `DocumentPageComponent` — the guard only uses these two members. */
	const page = (options: { dirty: boolean; flushes?: boolean }) => ({
		hasUnsavedChanges: options.dirty,
		flushPendingChanges: jest.fn(async () => options.flushes ?? true)
	});

	const dialog = (result: unknown) => ({ open: jest.fn(() => ({ onClose: of(result) })) });

	/**
	 * The guard is a functional `CanDeactivateFn` whose only Angular dependency is `inject()`, so
	 * all it needs is an injection context — not a compiled testing module. Going through
	 * `TestBed.resetTestingModule()` + `configureTestingModule()` + `TestBed.runInInjectionContext()`
	 * threw `Cannot read properties of null (reading 'ngModule')`, because resetting inside the
	 * helper leaves the TestBed with no instantiated injector at the moment the context is entered.
	 * A standalone `Injector` gives each case its own isolated context and no shared state to reset.
	 */
	const run = (component: unknown, dialogService: unknown): Promise<boolean> => {
		const injector = Injector.create({
			providers: [{ provide: NbDialogService, useValue: dialogService }]
		});

		return runInInjectionContext(
			injector,
			() =>
				docsUnsavedChangesGuard(component as never, null as never, null as never, null as never) as Promise<boolean>
		);
	};

	it('leaves immediately when nothing is dirty', async () => {
		const component = page({ dirty: false });
		const dialogService = dialog(true);

		await expect(run(component, dialogService)).resolves.toBe(true);
		expect(component.flushPendingChanges).not.toHaveBeenCalled();
		expect(dialogService.open).not.toHaveBeenCalled();
	});

	it('waits for the flush and leaves without asking when it lands', async () => {
		const component = page({ dirty: true, flushes: true });
		const dialogService = dialog(true);

		await expect(run(component, dialogService)).resolves.toBe(true);
		expect(component.flushPendingChanges).toHaveBeenCalledTimes(1);
		expect(dialogService.open).not.toHaveBeenCalled();
	});

	it('asks before discarding when the flush could not land', async () => {
		const component = page({ dirty: true, flushes: false });
		const dialogService = dialog(true);

		await expect(run(component, dialogService)).resolves.toBe(true);
		expect(dialogService.open).toHaveBeenCalledTimes(1);
	});

	it('stays on the page when the user declines', async () => {
		await expect(run(page({ dirty: true, flushes: false }), dialog(false))).resolves.toBe(false);
	});

	it('treats a dismissed dialog as "stay" — dismissing is not consent to lose edits', async () => {
		await expect(run(page({ dirty: true, flushes: false }), dialog(undefined))).resolves.toBe(false);
	});

	it('survives a component the router could not resolve', async () => {
		await expect(run(null, dialog(true))).resolves.toBe(true);
	});
});

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { NbButtonModule, NbCardModule, NbDialogRef, NbDialogService } from '@nebular/theme';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
// 🛑 Type-only. `docs.routes.ts` is eager, so a value import here would drag the whole
// TipTap editor chunk out from behind `loadComponent` and into the shell bundle
// (spec 05 §12 — the Documents list/tree/table must never pay for the editor).
import type { DocumentPageComponent } from '../pages/page-editor/document-page.component';

/**
 * "Leave anyway?" prompt (spec 04 §3.3, spec 05 §9.2 "route `CanDeactivate` — with confirm
 * if a save fails"). Standalone on purpose: it is opened from a functional guard, which has
 * no NgModule of its own, and declaring it in `docs-ui.module.ts` would couple the guard to
 * a file it does not own.
 */
@Component({
	selector: 'gz-docs-unsaved-changes-dialog',
	standalone: true,
	imports: [TranslateModule, NbButtonModule, NbCardModule],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<nb-card class="docs-dialog docs-unsaved-dialog">
			<nb-card-header>{{ 'DOCS.EDITOR.UNSAVED_TITLE' | translate }}</nb-card-header>
			<nb-card-body>{{ 'DOCS.EDITOR.DISCARD_CONFIRM' | translate }}</nb-card-body>
			<nb-card-footer class="docs-dialog-footer">
				<button nbButton ghost type="button" (click)="close(false)">
					{{ 'DOCS.EDITOR.UNSAVED_STAY' | translate }}
				</button>
				<button nbButton status="danger" type="button" (click)="close(true)">
					{{ 'DOCS.EDITOR.UNSAVED_LEAVE' | translate }}
				</button>
			</nb-card-footer>
		</nb-card>
	`
})
export class DocsUnsavedChangesDialogComponent {
	private readonly dialogRef = inject<NbDialogRef<DocsUnsavedChangesDialogComponent>>(NbDialogRef);

	close(leave: boolean): void {
		this.dialogRef.close(leave);
	}
}

/**
 * `canDeactivate` for `page/:id`.
 *
 * 🛑 Without this, leaving a dirty page silently lost edits: `DocumentPageComponent.ngOnDestroy`
 * fires a **fire-and-forget** `void flush()` while `DocumentAutosaveService.ngOnDestroy` clears
 * the retry timer in the same teardown — a save that failed on the way out was never retried and
 * nobody was told. The guard makes leaving wait for the flush, and asks before discarding when
 * the flush could not land (offline, a 409 conflict freeze, a 423 lock).
 *
 * A save already in flight also reports `false` (the autosave service is single-flight), so the
 * prompt can appear in that narrow window. That is the deliberate trade: a redundant question
 * beats a silently dropped paragraph.
 */
export const docsUnsavedChangesGuard: CanDeactivateFn<DocumentPageComponent> = (
	component: DocumentPageComponent
): Promise<boolean> => {
	// 🛑 `inject()` is only legal in the guard's *synchronous* injection context — resolving
	// the dialog service after the first `await` throws NG0203. Resolve it up front, even on
	// the clean-exit path where it goes unused.
	const dialogService = inject(NbDialogService);

	return (async () => {
		if (!component?.hasUnsavedChanges) return true;

		const saved = await component.flushPendingChanges();
		if (saved) return true;

		const leave = await firstValueFrom(
			dialogService.open(DocsUnsavedChangesDialogComponent, {
				closeOnEsc: true,
				closeOnBackdropClick: false
			}).onClose
		);
		return leave === true;
	})();
};

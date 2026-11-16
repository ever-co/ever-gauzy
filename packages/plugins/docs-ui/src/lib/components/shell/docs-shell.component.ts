import { Component, ElementRef, OnDestroy, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Actions } from '@ngneat/effects-ng';
import { Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { ID, IDocument } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { DocumentsActions } from '../../+state/documents.actions';
import { DocumentsQuery } from '../../+state/documents.query';
import { DocsPreviewModalComponent } from '../preview/docs-preview-modal.component';
import { DOCS_PREVIEW_DIALOG_CONFIG } from '../../docs.constants';
import { DocsTreeDrawerService } from '../../services/docs-tree-drawer.service';

/**
 * Shell for /pages/documents: the folder drawer (opened from the folder button in
 * each page's header, through `DocsTreeDrawerService`), the content router-outlet,
 * and the detail side panel host. The detail panel is not a route — it is
 * `?id=<documentId>` on the current URL.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gz-docs-shell',
	templateUrl: './docs-shell.component.html',
	styleUrls: ['./docs-shell.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class DocsShellComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	/** Folder drawer — closed on every visit, so the page always gets the full width. */
	public treeOpen = false;
	@ViewChild('treeDrawer') private readonly treeDrawer?: ElementRef<HTMLElement>;
	/** Whatever had focus when the drawer opened (the header's folder button) — focus returns there. */
	private openedFrom: HTMLElement | null = null;
	public detailId$: Observable<ID | null> = this.documentsQuery.detailId$;

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly actions: Actions,
		private readonly documentsQuery: DocumentsQuery,
		private readonly dialogService: NbDialogService,
		private readonly drawer: DocsTreeDrawerService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// Every page starts with the drawer closed, whatever an earlier visit left behind.
		this.drawer.close();
		this.drawer.open$.pipe(distinctUntilChanged(), untilDestroyed(this)).subscribe((open) => {
			if (open) this.onDrawerOpened();
			else this.onDrawerClosed();
		});

		// URL ?id= is the source of truth for the open detail panel.
		this.route.queryParamMap
			.pipe(
				map((params) => params.get('id')),
				distinctUntilChanged(),
				untilDestroyed(this)
			)
			.subscribe((id) => {
				const current = this.documentsQuery.detailId;
				if (id && String(current) !== id) {
					this.actions.dispatch(DocumentsActions.detailOpened(id));
				} else if (!id && current) {
					this.actions.dispatch(DocumentsActions.detailClosed());
				}
			});
	}

	ngOnDestroy(): void {
		this.drawer.close();
	}

	/**
	 * @param restoreFocus `false` when the user picked a destination in the tree —
	 * focus then belongs to where they went, not to the button that opened it.
	 */
	closeTree(restoreFocus = true): void {
		if (!this.treeOpen) return;
		if (!restoreFocus) this.openedFrom = null;
		this.drawer.close();
	}

	private onDrawerOpened(): void {
		this.openedFrom = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		this.treeOpen = true;
		// Keyboard users land inside the drawer; Escape is handled on it. Deferred one
		// task so the drawer is visible (no longer `visibility: hidden`) and focusable.
		setTimeout(() => this.treeDrawer?.nativeElement.focus());
	}

	private onDrawerClosed(): void {
		if (!this.treeOpen) return;
		this.treeOpen = false;
		this.openedFrom?.focus();
		this.openedFrom = null;
	}

	onDetailClosed(): void {
		this.actions.dispatch(DocumentsActions.detailClosed());
	}

	/**
	 * Every panel edit — taxonomy chips, archive/unarchive, knowledge toggle,
	 * reprocess, extracted-text save, share/visibility — lands here.
	 *
	 * The panel used to emit into nothing: the row behind it kept the values it was
	 * listed with, and the facets and preset counts (which are what the filter bar
	 * and the "Needs review" / "Not in knowledge" chips are derived from) went
	 * stale until the next full reload. `rowChanged` patches the row in place and
	 * `refreshFacets` re-counts, exactly as the panel's own review-request path
	 * already did for itself.
	 */
	onDetailChanged(document: IDocument): void {
		if (!document) return;
		this.actions.dispatch(DocumentsActions.rowChanged(document));
		this.actions.dispatch(DocumentsActions.refreshFacets());
	}

	/**
	 * The document behind the open panel is gone. `rowRemoved` drops it from the
	 * list and — because the effect closes a detail panel pointing at the removed
	 * id — also closes this panel, so nothing is left pointing at a 404.
	 */
	onDetailDeleted(id: ID): void {
		if (!id) return;
		this.actions.dispatch(DocumentsActions.rowRemoved(id));
		this.actions.dispatch(DocumentsActions.refreshFacets());
	}

	onOpenEditor(id: ID): void {
		this.router.navigate(['page', id], { relativeTo: this.route });
	}

	onOpenPreview(document: IDocument): void {
		this.dialogService.open(DocsPreviewModalComponent, { ...DOCS_PREVIEW_DIALOG_CONFIG, context: { document } });
	}
}

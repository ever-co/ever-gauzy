import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ofType } from '@ngneat/effects';
import { Actions } from '@ngneat/effects-ng';
import { combineLatest, firstValueFrom } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { BaseEntityEnum, ID, IDocument, IOrganization } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { RecordViewPageState, recordViewPageStateOf } from '@gauzy/ui-core/shared';
import { DocumentsActions } from '../../+state/documents.actions';
import { DOCS_PAGE_LINK } from '../../docs.constants';
import { DocumentsService } from '../../services/documents.service';
import { documentViewRedirect, previewSignature } from './document-file-view';

/**
 * One document on its own, full width: `/pages/documents/file/:id` — how a sidebar favorite opens an
 * uploaded file (owner, 2026-10-15: a favorite "should display document full width, not display a list of
 * documents"). It sits in the Documents shell, so only the narrow "All documents" tree stays beside it; the
 * file's preview takes the content area, and its details open in the shell's side column on request.
 *
 * A favorite whose kind was unknown when its link was built lands here too: a page goes on to the page editor
 * and a folder to that folder (`documentViewRedirect`).
 *
 * The page follows what the rest of Documents does to the file it shows: the header's organization (the file
 * is reloaded, and one of another organization is not shown), an edit made in the details column (the preview
 * is rebuilt from the changed row), and a deletion (back to the documents list).
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gz-document-file-page',
	templateUrl: './document-file-page.component.html',
	styleUrls: ['./document-file-page.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class DocumentFilePageComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	readonly favoriteEntity = BaseEntityEnum.Document;
	readonly backLink = DOCS_PAGE_LINK;

	document: IDocument = null;
	state: RecordViewPageState = 'loading';
	/**
	 * Bumped whenever the shown file changes, so the preview is created anew: it reads its content once, when it
	 * starts, and an edit (corrected extracted text, a new version) must show.
	 */
	previewRevision = 0;

	private documentId: string = null;
	private organizationId: string = null;
	/** Every load, and leaving the page, takes a new number; a result that comes back under an old one is dropped. */
	private loadSequence = 0;

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly documentsService: DocumentsService,
		private readonly store: Store,
		private readonly actions: Actions
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// The component is reused across `file/:id` navigations (one favorite after another), and the page follows
		// the header's organization: either changing reloads.
		const id$ = this.route.paramMap.pipe(
			map((params) => params.get('id')),
			filter((id): id is string => !!id),
			distinctUntilChanged()
		);
		const organizationId$ = this.store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization?.id),
			map((organization: IOrganization) => organization.id),
			distinctUntilChanged()
		);
		combineLatest([id$, organizationId$])
			.pipe(untilDestroyed(this))
			.subscribe(([id, organizationId]) => {
				this.documentId = id;
				this.organizationId = organizationId;
				void this.load();
			});

		// An edit made in the details column — the preview reads its content once, so it is rebuilt; an unchanged row
		// (re-sent on every processing poll) or a rename only updates the page.
		this.actions
			.pipe(
				ofType(DocumentsActions.rowChanged),
				filter(({ document }) => !!document?.id && String(document.id) === String(this.document?.id)),
				untilDestroyed(this)
			)
			.subscribe(({ document }) => {
				const before = previewSignature(this.document);
				this.document = { ...this.document, ...document };
				if (previewSignature(this.document) !== before) {
					this.previewRevision++;
				}
			});

		// The file was deleted: nothing is left to show here.
		this.actions
			.pipe(
				ofType(DocumentsActions.rowRemoved),
				filter(({ id }) => !!id && String(id) === String(this.document?.id)),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.loadSequence++;
				this.document = null;
				void this.router.navigate([DOCS_PAGE_LINK], { replaceUrl: true });
			});
	}

	ngOnDestroy(): void {
		// A load still in flight must neither redirect nor fill a page the viewer has left.
		this.loadSequence++;
	}

	async load(): Promise<void> {
		const id = this.documentId;
		const organizationId = this.organizationId;
		if (!id || !organizationId) {
			return;
		}
		const sequence = ++this.loadSequence;
		// Nothing of the previous document (or organization) stays on screen — nor reachable by the star.
		this.document = null;
		this.state = 'loading';
		try {
			const document = await firstValueFrom(this.documentsService.getById(id as ID));
			if (sequence !== this.loadSequence) {
				return; // a newer navigation, an organization switch or leaving the page owns it now
			}
			if (!document?.id || (document.organizationId && document.organizationId !== organizationId)) {
				throw { status: 404 };
			}
			const redirect = documentViewRedirect(document);
			if (redirect) {
				void this.router.navigate(redirect.commands, { queryParams: redirect.queryParams, replaceUrl: true });
				return;
			}
			this.document = document;
			this.previewRevision++;
			this.state = 'ready';
		} catch (error) {
			if (sequence === this.loadSequence) {
				this.state = recordViewPageStateOf(error);
			}
		}
	}
}

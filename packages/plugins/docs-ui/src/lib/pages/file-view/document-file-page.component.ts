import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { firstValueFrom } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { BaseEntityEnum, ID, IDocument } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { RecordViewPageState, recordViewPageStateOf } from '@gauzy/ui-core/shared';
import { DOCS_PAGE_LINK } from '../../docs.constants';
import { DocumentsService } from '../../services/documents.service';
import { documentViewRedirect } from './document-file-view';

/**
 * One document on its own, full width: `/pages/documents/file/:id` — how a sidebar favorite opens an
 * uploaded file (owner, 2026-10-15: a favorite "should display document full width, not display a list of
 * documents"). It sits in the Documents shell, so only the narrow "All documents" tree stays beside it; the
 * file's preview takes the content area, and its details open in the shell's side column on request.
 *
 * A favorite whose kind was unknown when its link was built lands here too: a page goes on to the page editor
 * and a folder to that folder (`documentViewRedirect`).
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gz-document-file-page',
	templateUrl: './document-file-page.component.html',
	styleUrls: ['./document-file-page.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class DocumentFilePageComponent extends TranslationBaseComponent implements OnInit {
	readonly favoriteEntity = BaseEntityEnum.Document;
	readonly backLink = DOCS_PAGE_LINK;

	document: IDocument = null;
	state: RecordViewPageState = 'loading';

	private documentId: string = null;
	private loadSequence = 0;

	constructor(
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly documentsService: DocumentsService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		// The component is reused across `file/:id` navigations (one favorite after another).
		this.route.paramMap
			.pipe(
				map((params) => params.get('id')),
				filter((id): id is string => !!id),
				distinctUntilChanged(),
				untilDestroyed(this)
			)
			.subscribe((id) => {
				this.documentId = id;
				void this.load();
			});
	}

	async load(): Promise<void> {
		const id = this.documentId;
		if (!id) {
			return;
		}
		const sequence = ++this.loadSequence;
		// Nothing of the previous document stays on screen — nor reachable by the star.
		this.document = null;
		this.state = 'loading';
		try {
			const document = await firstValueFrom(this.documentsService.getById(id as ID));
			if (sequence !== this.loadSequence) {
				return; // a newer navigation owns the page
			}
			if (!document?.id) {
				throw { status: 404 };
			}
			const redirect = documentViewRedirect(document);
			if (redirect) {
				void this.router.navigate(redirect.commands, { queryParams: redirect.queryParams, replaceUrl: true });
				return;
			}
			this.document = document;
			this.state = 'ready';
		} catch (error) {
			if (sequence === this.loadSequence) {
				this.state = recordViewPageStateOf(error);
			}
		}
	}
}

import { Component, OnInit } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { catchError, filter, of, Subject, switchMap, tap } from 'rxjs';
import { DocumentStatusEnum } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { IDocumentStats } from '../../models/docs-api.model';
import { humanizeBytes } from '../../models/docs-format.util';
import { DocumentsService } from '../../services/documents.service';

interface IDocsStatTile {
	labelKey: string;
	value: string;
	/** CSS color value; `''` = the theme's default text color (strict-templates: never undefined). */
	color: string;
}

/**
 * Org-global stats tiles above the filter bar (`GET /documents/stats`).
 *
 * Deliberately NOT filter-relative — the preset chips already are: tiles answer
 * "what is in this organization", so they load once, reload on an org switch and
 * on the page's explicit `reload()` calls (upload settled, bulk finished).
 *
 * Cosmetic surface: any failure — including 404 on a deployment whose API
 * predates the endpoint — hides the whole strip rather than surfacing an error,
 * so a UI-first deploy degrades silently.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'gz-docs-stats-line',
	templateUrl: './docs-stats-line.component.html',
	styleUrls: ['./docs-stats-line.component.scss'],
	standalone: false
})
export class DocsStatsLineComponent implements OnInit {
	public tiles: IDocsStatTile[] = [];
	public loading = false;
	public visible = false;

	private readonly reload$ = new Subject<void>();

	constructor(private readonly documentsService: DocumentsService, private readonly store: Store) {}

	ngOnInit(): void {
		// switchMap: an org switch mid-flight must never let the old org's numbers land.
		this.reload$
			.pipe(
				tap(() => (this.loading = true)),
				switchMap(() => this.documentsService.getStats().pipe(catchError(() => of(null)))),
				untilDestroyed(this)
			)
			.subscribe((stats) => {
				this.loading = false;
				this.visible = !!stats;
				this.tiles = stats ? this.buildTiles(stats) : [];
			});

		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				distinctUntilChange(),
				tap(() => this.reload()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/** Public on purpose — the browse page re-pulls after uploads and bulk actions settle. */
	reload(): void {
		this.reload$.next();
	}

	trackByLabel(_index: number, tile: IDocsStatTile): string {
		return tile.labelKey;
	}

	private buildTiles(stats: IDocumentStats): IDocsStatTile[] {
		const byStatus = stats.byStatus ?? {};
		// UPLOADED is the internal first phase the user is never shown — it reads
		// "Processing" everywhere (badge, facet, URL), so the tile folds it too.
		const processing =
			(byStatus[DocumentStatusEnum.PROCESSING] ?? 0) + (byStatus[DocumentStatusEnum.UPLOADED] ?? 0);
		const tiles: IDocsStatTile[] = [
			{ labelKey: 'DOCS.STATS.TOTAL', value: String(stats.total ?? 0), color: '' },
			{
				labelKey: 'DOCS.STATS.READY',
				value: String(byStatus[DocumentStatusEnum.READY] ?? 0),
				color: 'var(--color-success-default)'
			},
			{ labelKey: 'DOCS.STATS.PROCESSING', value: String(processing), color: 'var(--color-info-default)' },
			{
				labelKey: 'DOCS.STATS.FAILED',
				value: String(byStatus[DocumentStatusEnum.FAILED] ?? 0),
				color: 'var(--color-danger-default)'
			},
			{
				labelKey: 'DOCS.STATS.NEEDS_REVIEW',
				value: String(stats.needsReview ?? 0),
				color: 'var(--color-warning-default)'
			}
		];

		// Storage renders only when the deployment reports real usage — never an
		// assumed "0 of 0" (which reads as a hard-full quota).
		const storage = stats.storage;
		if (storage && typeof storage.usedBytes === 'number' && Number.isFinite(storage.usedBytes)) {
			const used = storage.usedBytes ? humanizeBytes(storage.usedBytes) : '0 B';
			tiles.push({
				labelKey: 'DOCS.STATS.STORAGE',
				value: storage.quotaBytes > 0 ? `${used} / ${humanizeBytes(storage.quotaBytes)}` : used,
				color: ''
			});
		}
		return tiles;
	}
}

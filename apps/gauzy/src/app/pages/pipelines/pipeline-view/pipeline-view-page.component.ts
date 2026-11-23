import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, firstValueFrom } from 'rxjs';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import { IDeal, IOrganization, IPipeline, PermissionsEnum } from '@gauzy/contracts';
import { ErrorHandlingService, PipelinesService, Store, ToastrService } from '@gauzy/ui-core/core';
import { IRecordViewScope, RecordViewPageState, recordViewPageStateOf } from '@gauzy/ui-core/shared';
import { PipelineFormComponent } from '../pipeline-form/pipeline-form.component';
import {
	buildPipelineStageRows,
	buildProbabilityRows,
	buildRecentDealRows,
	countDealClients,
	IPipelineDealRow,
	IPipelineProbabilityRow,
	IPipelineStageRow,
	loadPipeline,
	loadPipelineDeals,
	PIPELINES_LIST_LINK
} from '../pipeline-record-view';

/**
 * A pipeline on its own page, `/pages/sales/pipelines/view/:id`: its name, status and description, its
 * key figures, its stages in order with how many deals sit at each, its newest deals, its deals by
 * probability, and who created it and when. Opens the pipeline's deals, and lets a user who may edit
 * pipelines edit it in place.
 *
 * Like the list, the page belongs to the organization selected in the header: a pipeline of another
 * organization reads "not found", and switching the organization reloads the page.
 */
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-pipeline-view-page',
	templateUrl: './pipeline-view-page.component.html',
	styleUrls: ['./pipeline-view-page.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
	standalone: false
})
export class PipelineViewPageComponent implements OnInit, OnDestroy {
	private readonly route = inject(ActivatedRoute);
	private readonly pipelinesService = inject(PipelinesService);
	private readonly dialogService = inject(NbDialogService);
	private readonly toastrService = inject(ToastrService);
	private readonly errorHandlingService = inject(ErrorHandlingService);
	private readonly store = inject(Store);
	private readonly cdr = inject(ChangeDetectorRef);

	readonly backLink = PIPELINES_LIST_LINK;

	pipeline: IPipeline = null;
	deals: IDeal[] | null = null;
	stageRows: IPipelineStageRow[] = [];
	recentDeals: IPipelineDealRow[] = [];
	probabilityRows: IPipelineProbabilityRow[] = [];
	/** Different clients the deals are for. */
	clientCount = 0;
	/** Deals at the highest probability. */
	highProbabilityCount = 0;
	/** The creator's initials, shown when they have no photo. */
	creatorInitials = '';
	state: RecordViewPageState = 'loading';

	/** A deal's title opens its edit page only for a user who may edit pipelines (as the deals page's Edit). */
	get canEditDeals(): boolean {
		return this.store.hasAnyPermission(PermissionsEnum.EDIT_SALES_PIPELINES);
	}

	private pipelineId: string = null;
	private organization: IOrganization = null;
	/** Bumped by every load; a load that is no longer the latest one when it answers is discarded. */
	private loadSequence = 0;

	ngOnInit(): void {
		const id$ = this.route.paramMap.pipe(
			map((params) => params.get('id')),
			filter((id): id is string => !!id),
			distinctUntilChanged()
		);
		const organization$ = this.store.selectedOrganization$.pipe(
			filter((organization: IOrganization) => !!organization?.id),
			distinctUntilChanged((a: IOrganization, b: IOrganization) => a.id === b.id)
		);
		combineLatest([id$, organization$])
			.pipe(untilDestroyed(this))
			.subscribe(([id, organization]) => {
				this.pipelineId = id;
				this.organization = organization;
				void this.load();
			});
	}

	ngOnDestroy(): void {
		this.loadSequence++;
	}

	/**
	 * Loads (or reloads) the pipeline the URL names, then its deals for the per-stage counts.
	 */
	async load(): Promise<void> {
		const id = this.pipelineId;
		const scope = this.scope();
		if (!id || !scope) {
			return;
		}
		const sequence = ++this.loadSequence;
		this.pipeline = null;
		this.deals = null;
		this.stageRows = [];
		this.recentDeals = [];
		this.probabilityRows = [];
		this.state = 'loading';
		this.cdr.markForCheck();
		try {
			const pipeline = await loadPipeline(this.pipelinesService, id, scope);
			if (sequence !== this.loadSequence) {
				return;
			}
			if (!pipeline || String(pipeline.id) !== String(id) || pipeline.organizationId !== scope.organizationId) {
				throw { status: 404 };
			}
			const deals = await loadPipelineDeals(this.pipelinesService, pipeline);
			if (sequence !== this.loadSequence) {
				return;
			}
			this.pipeline = pipeline;
			this.deals = deals;
			this.describe();
			this.state = 'ready';
		} catch (error) {
			if (sequence !== this.loadSequence) {
				return;
			}
			this.state = recordViewPageStateOf(error);
		} finally {
			this.cdr.markForCheck();
		}
	}

	/**
	 * Edits the pipeline in the same dialog the list uses, then reloads the page.
	 */
	async edit(): Promise<void> {
		if (!this.pipeline) {
			return;
		}
		try {
			const dialogRef = this.dialogService.open(PipelineFormComponent, {
				context: { pipeline: this.pipeline }
			});
			const updated = await firstValueFrom(dialogRef.onClose);
			if (updated) {
				this.toastrService.success('TOASTR.MESSAGE.PIPELINE_UPDATED', { name: this.pipeline.name });
				await this.load();
			}
		} catch (error) {
			this.errorHandlingService.handleError(error);
		}
	}

	private describe(): void {
		if (!this.pipeline) {
			return;
		}
		this.stageRows = buildPipelineStageRows(this.pipeline, this.deals);
		const deals = this.deals ?? [];
		this.recentDeals = buildRecentDealRows(this.pipeline, deals);
		this.probabilityRows = buildProbabilityRows(deals);
		this.clientCount = countDealClients(deals);
		this.highProbabilityCount = this.probabilityRows.find((row) => row.level === 'high')?.count ?? 0;
		this.creatorInitials = (this.pipeline.createdByUser?.name ?? '')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0].toUpperCase())
			.join('');
	}

	private scope(): IRecordViewScope | null {
		return this.organization ? { organizationId: this.organization.id, tenantId: this.organization.tenantId } : null;
	}
}

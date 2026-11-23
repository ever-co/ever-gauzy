import { firstValueFrom } from 'rxjs';
import { ID, IDeal, IPipeline, IPipelineStage } from '@gauzy/contracts';
import { PipelinesService } from '@gauzy/ui-core/core';
import { IRecordViewScope } from '@gauzy/ui-core/shared';
import {
	DealProbabilityLevel,
	dealProbabilityLevel
} from './table-components/pipeline-deal-probability/deal-probability';

/** The pipelines list: where a pipeline's page goes back to. */
export const PIPELINES_LIST_LINK = '/pages/sales/pipelines';

/** Relations a pipeline's page reads. */
export const PIPELINE_VIEW_RELATIONS = ['stages', 'createdByUser'];

/** Relations of the pipeline's deals the page reads. */
export const PIPELINE_DEAL_RELATIONS = ['client'];

/** How many of the newest deals the page lists. */
export const PIPELINE_RECENT_DEALS = 8;

/**
 * Loads one pipeline of the selected organization, with its stages and its creator.
 *
 * @param pipelinesService The pipelines API.
 * @param id The pipeline's ID.
 * @param scope The organization and tenant the page belongs to.
 */
export function loadPipeline(pipelinesService: PipelinesService, id: ID, scope: IRecordViewScope): Promise<IPipeline> {
	return firstValueFrom(
		pipelinesService.getById(
			id,
			{ organizationId: scope.organizationId, tenantId: scope.tenantId },
			PIPELINE_VIEW_RELATIONS
		)
	);
}

/**
 * Loads a pipeline's deals, to count them per stage. Resolves `null` when they cannot be read, so the
 * pipeline itself still shows (without its counts).
 *
 * @param pipelinesService The pipelines API.
 * @param pipeline The pipeline whose deals to read.
 */
export async function loadPipelineDeals(pipelinesService: PipelinesService, pipeline: IPipeline): Promise<IDeal[] | null> {
	try {
		const { items } = await pipelinesService.getPipelineDeals(
			pipeline.id,
			{ organizationId: pipeline.organizationId, tenantId: pipeline.tenantId },
			// `client`: the recent deals name their client, and the figures count the clients.
			PIPELINE_DEAL_RELATIONS
		);
		return items ?? [];
	} catch {
		return null;
	}
}

/** One stage of a pipeline's page, in the pipeline's order, with the deals that sit at it. */
export interface IPipelineStageRow {
	id: ID;
	/** 1-based position in the pipeline. */
	position: number;
	name: string;
	description: string | null;
	/** Deals at this stage, or `null` when the deals could not be read. */
	count: number | null;
	/** This stage's share of the pipeline's deals, 0–100 (0 when there are none). */
	share: number;
}

/**
 * A pipeline's stages in order, each with how many of `deals` sit at it and its share of them.
 *
 * @param pipeline The pipeline, with its stages.
 * @param deals The pipeline's deals, or `null` when they could not be read (no counts, no shares).
 */
export function buildPipelineStageRows(pipeline: IPipeline, deals: IDeal[] | null): IPipelineStageRow[] {
	const stages: IPipelineStage[] = [...(pipeline.stages ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
	const total = deals?.length ?? 0;
	return stages.map((stage, index) => {
		const count = deals ? deals.filter((deal) => deal.stageId === stage.id).length : null;
		return {
			id: stage.id,
			position: index + 1,
			name: stage.name,
			description: stage.description?.trim() || null,
			count,
			share: count && total ? Math.round((count / total) * 100) : 0
		};
	});
}

/** One of the pipeline's newest deals, as the page lists it. */
export interface IPipelineDealRow {
	id: ID;
	title: string;
	client: string | null;
	/** The stage the deal sits at, or `null` when it is not one of the pipeline's stages. */
	stage: string | null;
	level: DealProbabilityLevel;
	/** i18n key wording the level, e.g. `PIPELINE_DEALS_PAGE.HIGH`. */
	levelKey: string;
	createdAt: Date | null;
}

/**
 * The pipeline's newest deals first, at most `limit` of them.
 *
 * @param pipeline The pipeline, with its stages (to name each deal's stage).
 * @param deals The pipeline's deals, with their clients.
 * @param limit How many to list.
 */
export function buildRecentDealRows(
	pipeline: IPipeline,
	deals: IDeal[],
	limit: number = PIPELINE_RECENT_DEALS
): IPipelineDealRow[] {
	const stageNames = new Map((pipeline.stages ?? []).map((stage) => [stage.id, stage.name]));
	const time = (deal: IDeal) => (deal.createdAt ? new Date(deal.createdAt).getTime() : 0);
	return [...deals]
		.sort((a, b) => time(b) - time(a))
		.slice(0, limit)
		.map((deal) => {
			const level = dealProbabilityLevel(deal.probability);
			return {
				id: deal.id,
				title: deal.title,
				client: deal.client?.name || null,
				stage: stageNames.get(deal.stageId) ?? null,
				level,
				levelKey: `PIPELINE_DEALS_PAGE.${level.toUpperCase()}`,
				createdAt: deal.createdAt ?? null
			};
		});
}

/** How many of the pipeline's deals sit at one probability level. */
export interface IPipelineProbabilityRow {
	level: DealProbabilityLevel;
	/** i18n key wording the level. */
	levelKey: string;
	count: number;
	/** Share of the pipeline's deals, 0–100. */
	share: number;
}

/** The probability levels, likeliest first — the order the breakdown reads in. */
const PROBABILITY_LEVELS: DealProbabilityLevel[] = ['high', 'medium', 'low', 'unknown'];

/**
 * The pipeline's deals counted per probability level, likeliest first. An "unknown" level with no deals is
 * left out: it only shows when some deal has no probability set.
 *
 * @param deals The pipeline's deals.
 */
export function buildProbabilityRows(deals: IDeal[]): IPipelineProbabilityRow[] {
	const total = deals.length;
	return PROBABILITY_LEVELS.map((level) => {
		const count = deals.filter((deal) => dealProbabilityLevel(deal.probability) === level).length;
		return {
			level,
			levelKey: `PIPELINE_DEALS_PAGE.${level.toUpperCase()}`,
			count,
			share: total ? Math.round((count / total) * 100) : 0
		};
	}).filter((row) => row.level !== 'unknown' || row.count > 0);
}

/**
 * How many different clients the deals are for.
 *
 * @param deals The pipeline's deals.
 */
export function countDealClients(deals: IDeal[]): number {
	return new Set(deals.map((deal) => deal.clientId || deal.client?.id).filter(Boolean)).size;
}

/** How likely a deal is to close, as its probability chip words it. */
export type DealProbabilityLevel = 'low' | 'medium' | 'high' | 'unknown';

/** The probability chip of a level: its class (styled by the probability chip's stylesheet) and its label. */
export interface IDealProbabilityBadge {
	level: DealProbabilityLevel;
	className: string;
	labelKey: string;
}

const PROBABILITY_BADGE_CLASSES: Record<DealProbabilityLevel, string> = {
	low: 'badge-danger',
	medium: 'badge-warning',
	high: 'badge-success',
	unknown: 'badge-primary'
};

/** A probability's level: 1–2 low, 3–4 medium, 5 high, anything else unknown. */
export function dealProbabilityLevel(probability: number | string | null | undefined): DealProbabilityLevel {
	switch (Number(probability)) {
		case 1:
		case 2:
			return 'low';
		case 3:
		case 4:
			return 'medium';
		case 5:
			return 'high';
		default:
			return 'unknown';
	}
}

/**
 * The chip of a deal's probability. Shared by the deals table and the deals board, so the two never word
 * one deal differently.
 */
export function dealProbabilityBadge(probability: number | string | null | undefined): IDealProbabilityBadge {
	const level = dealProbabilityLevel(probability);
	return {
		level,
		className: PROBABILITY_BADGE_CLASSES[level],
		labelKey: `PIPELINE_DEALS_PAGE.${level.toUpperCase()}`
	};
}

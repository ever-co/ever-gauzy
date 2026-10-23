import { gauzyToggleFeatures } from '@gauzy/config';
import { DEFAULT_ENABLED_FEATURES } from './commerce-feature-catalogue';

/** The codes the catalogue enables on a fresh install, as a set to test membership with. */
const DEFAULT_ENABLED_FEATURE_CODES = new Set(DEFAULT_ENABLED_FEATURES.map((entry) => entry.code));

/**
 * Whether a feature is on for a scope that has never switched it.
 *
 * The deployment's own toggles win: an operator who set a flag in configuration has answered the
 * question for every tenant, and nothing here overrides that. What the catalogue adds is the answer
 * for a code configuration does not mention — and the previous fallback, `?? true`, gave every
 * unmentioned code the answer "on".
 *
 * That was harmless while the catalogue was small and every entry was on. It stopped being harmless
 * when the catalogue grew to include modules a tenant opts into: a tenant created through the API
 * has a toggle built for every catalogue row, so the fallback decided every opt-in module's initial
 * state, and it decided it "on". A module that duplicates data into a projection, moves money, or
 * exposes a surface the tenant never asked for would then be live from the tenant's first request.
 * A code the catalogue marks default-off is now created off, which is what the catalogue says.
 *
 * Two readers share this one answer, so they cannot disagree about it: `FeatureSubscriber`, which
 * gives a loaded catalogue row its virtual `isEnabled` (and so decides a new tenant's toggle rows), and
 * `FeatureService.isFeatureEnabled` for a request that carries no tenant — a `@Public()` handler — where
 * no stored toggle can answer and this default is the only answer that holds for every scope.
 *
 * @param code - The feature code.
 * @returns True when the feature is on without anyone having enabled it.
 */
export function isFeatureEnabledByDefault(code: string): boolean {
	const configured = gauzyToggleFeatures[code];
	if (configured !== undefined) {
		return !!configured;
	}
	return DEFAULT_ENABLED_FEATURE_CODES.has(code);
}

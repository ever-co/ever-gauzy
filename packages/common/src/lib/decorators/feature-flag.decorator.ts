import { CustomDecorator } from '@nestjs/common';
import { FEATURE_METADATA } from '@gauzy/constants';
import { FeatureEnum } from '@gauzy/contracts';

/**
 * What `FEATURE_METADATA` holds on one target.
 *
 * A single code when one `@FeatureFlag` was declared there — the shape it has always had, so every reader
 * that expects one code keeps reading one code — and every code, in the order they are written, when
 * several are stacked on the same target.
 */
export type FeatureFlagMetadata = FeatureEnum | FeatureEnum[];

/**
 * Every code a `FEATURE_METADATA` value states, as a list.
 *
 * The one place the two shapes of {@link FeatureFlagMetadata} are told apart, so a guard or a spec reads a
 * target's codes without knowing whether one or several were declared.
 *
 * @param metadata The value read from a handler or a class, or nothing when none was declared.
 * @returns The codes, in declaration order; empty when none was declared.
 */
export function featureFlagsOf(metadata: FeatureFlagMetadata | null | undefined): FeatureEnum[] {
	if (metadata === undefined || metadata === null) {
		return [];
	}

	return (Array.isArray(metadata) ? metadata : [metadata]).filter(
		(flag): flag is FeatureEnum => flag !== undefined && flag !== null
	);
}

/**
 * Gates a handler or a class on a feature code; stated more than once, on every code stated.
 *
 * **Stacked codes accumulate.** This used to be `SetMetadata(FEATURE_METADATA, feature)`, which writes one
 * value per target, so of two `@FeatureFlag`s on one class the upper one — applied last, because decorators
 * apply bottom-up — silently replaced the lower one. A resolver written as
 *
 *     @FeatureFlag(FEATURE_GRAPHQL)
 *     @FeatureFlag(WarehouseFeatures.WAREHOUSE)
 *
 * was gated on the GraphQL endpoint alone, and its mutations kept running for an organization that had
 * switched the warehouse capability off while the capability's REST routes answered 404. Each decorator now
 * adds its code to the ones already declared on the same target, and `FeatureFlagGuard` (and
 * `FeatureFlagEnabledGuard`) require every one of them.
 *
 * **One code is stored exactly as before**, as the bare code rather than a list of one, so everything that
 * reads the metadata of a single-flag target — the guards' own single-flag path, `StatsGuard`, and every spec
 * that asserts `Reflect.getMetadata(FEATURE_METADATA, …)` — sees the value it always saw. Only a target that
 * states several codes holds a list; read it through {@link featureFlagsOf}.
 *
 * **A handler's codes replace its class's, as they always have.** Accumulation is per target: the codes
 * stacked on a method are that method's gate, and the class's codes apply to a handler that declares none.
 * The metadata is read as the target's own (not inherited through a parent class), for the same reason: a
 * subclass that states a code overrides its parent's rather than adding to it, exactly as the single-value
 * decorator did.
 *
 * @param feature The feature code the target requires.
 * @returns A decorator for a class or a method.
 */
export const FeatureFlag = (feature: FeatureEnum): CustomDecorator<typeof FEATURE_METADATA> => {
	const decorator = (target: object, _key?: string | symbol, descriptor?: TypedPropertyDescriptor<unknown>) => {
		// The same holder `SetMetadata` writes to: the method itself for a handler, the class for a class.
		const holder = descriptor ? (descriptor.value as object) : target;
		const declared = featureFlagsOf(Reflect.getOwnMetadata(FEATURE_METADATA, holder));

		// Decorators apply bottom-up, so the code being added is written above every code already here:
		// putting it first keeps the list in the order the source states it. A repeated code is stated once.
		const flags = [feature, ...declared.filter((flag) => flag !== feature)];

		Reflect.defineMetadata(FEATURE_METADATA, flags.length === 1 ? flags[0] : flags, holder);

		return descriptor ?? target;
	};

	decorator.KEY = FEATURE_METADATA;

	return decorator as CustomDecorator<typeof FEATURE_METADATA>;
};

import 'reflect-metadata';
import { FEATURE_METADATA } from '@gauzy/constants';
import { FeatureEnum } from '@gauzy/contracts';
import { FeatureFlag, featureFlagsOf } from './feature-flag.decorator';

/**
 * `@FeatureFlag` stated more than once on one target keeps every code.
 *
 * It used to be `SetMetadata`, which writes one value per target, so the upper of two stacked decorators —
 * applied last, since decorators apply bottom-up — replaced the lower one, and the lower code was never
 * checked. A single code must still be stored exactly as before: every guard and spec that reads the metadata
 * of a one-code target reads the bare code.
 */
describe('FeatureFlag', () => {
	it('stores a single code as the bare code, on a class and on a method', () => {
		@FeatureFlag(FeatureEnum.FEATURE_INVOICE)
		class Gated {
			@FeatureFlag(FeatureEnum.FEATURE_ESTIMATE)
			route() {
				return undefined;
			}
		}

		expect(Reflect.getMetadata(FEATURE_METADATA, Gated)).toBe(FeatureEnum.FEATURE_INVOICE);
		expect(Reflect.getMetadata(FEATURE_METADATA, Gated.prototype.route)).toBe(FeatureEnum.FEATURE_ESTIMATE);
	});

	it('accumulates stacked codes on a class, in the order they are written', () => {
		@FeatureFlag(FeatureEnum.FEATURE_INVOICE)
		@FeatureFlag(FeatureEnum.FEATURE_ESTIMATE)
		@FeatureFlag(FeatureEnum.FEATURE_JOB)
		class Gated {}

		expect(Reflect.getMetadata(FEATURE_METADATA, Gated)).toEqual([
			FeatureEnum.FEATURE_INVOICE,
			FeatureEnum.FEATURE_ESTIMATE,
			FeatureEnum.FEATURE_JOB
		]);
	});

	it('accumulates stacked codes on a method without touching the class’s', () => {
		@FeatureFlag(FeatureEnum.FEATURE_JOB)
		class Gated {
			@FeatureFlag(FeatureEnum.FEATURE_INVOICE)
			@FeatureFlag(FeatureEnum.FEATURE_ESTIMATE)
			route() {
				return undefined;
			}

			plain() {
				return undefined;
			}
		}

		expect(Reflect.getMetadata(FEATURE_METADATA, Gated.prototype.route)).toEqual([
			FeatureEnum.FEATURE_INVOICE,
			FeatureEnum.FEATURE_ESTIMATE
		]);
		expect(Reflect.getMetadata(FEATURE_METADATA, Gated.prototype.plain)).toBeUndefined();
		expect(Reflect.getMetadata(FEATURE_METADATA, Gated)).toBe(FeatureEnum.FEATURE_JOB);
	});

	it('states a repeated code once', () => {
		@FeatureFlag(FeatureEnum.FEATURE_INVOICE)
		@FeatureFlag(FeatureEnum.FEATURE_INVOICE)
		class Gated {}

		expect(Reflect.getMetadata(FEATURE_METADATA, Gated)).toBe(FeatureEnum.FEATURE_INVOICE);
	});

	it('lets a subclass that states its own code override its parent’s rather than add to it', () => {
		// The same override the single-value decorator gave: the subclass's own metadata shadows the
		// parent's, so a subclass is never silently gated on a code it did not state.
		@FeatureFlag(FeatureEnum.FEATURE_INVOICE)
		class Parent {}

		@FeatureFlag(FeatureEnum.FEATURE_ESTIMATE)
		class Child extends Parent {}

		class Inheriting extends Parent {}

		expect(Reflect.getMetadata(FEATURE_METADATA, Child)).toBe(FeatureEnum.FEATURE_ESTIMATE);
		expect(Reflect.getMetadata(FEATURE_METADATA, Inheriting)).toBe(FeatureEnum.FEATURE_INVOICE);
		expect(Reflect.getMetadata(FEATURE_METADATA, Parent)).toBe(FeatureEnum.FEATURE_INVOICE);
	});

	it('keeps the metadata key a caller can read off the decorator, as SetMetadata did', () => {
		expect(FeatureFlag(FeatureEnum.FEATURE_INVOICE).KEY).toBe(FEATURE_METADATA);
	});
});

describe('featureFlagsOf', () => {
	it('reads both shapes of the metadata as a list', () => {
		expect(featureFlagsOf(undefined)).toEqual([]);
		expect(featureFlagsOf(null)).toEqual([]);
		expect(featureFlagsOf(FeatureEnum.FEATURE_INVOICE)).toEqual([FeatureEnum.FEATURE_INVOICE]);
		expect(featureFlagsOf([FeatureEnum.FEATURE_INVOICE, FeatureEnum.FEATURE_JOB])).toEqual([
			FeatureEnum.FEATURE_INVOICE,
			FeatureEnum.FEATURE_JOB
		]);
	});
});

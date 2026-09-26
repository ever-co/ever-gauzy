import { EventSubscriber } from 'typeorm';
import { shuffle } from 'underscore';
import { gauzyToggleFeatures } from '@gauzy/config';
import { FeatureStatusEnum, FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from './../core/file-storage';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { DEFAULT_ENABLED_FEATURES } from './commerce-feature-catalogue';
import { Feature } from './feature.entity';

/** The codes the catalogue enables on a fresh install, as a set to test membership with. */
const DEFAULT_ENABLED_FEATURE_CODES = new Set(DEFAULT_ENABLED_FEATURES.map((entry) => entry.code));

/**
 * Whether a feature is on for a tenant that has never switched it.
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
 * @param code - The feature code.
 * @returns True when the feature is on without anyone having enabled it.
 */
function isEnabledByDefault(code: string): boolean {
	const configured = gauzyToggleFeatures[code];
	if (configured !== undefined) {
		return !!configured;
	}
	return DEFAULT_ENABLED_FEATURE_CODES.has(code);
}

@EventSubscriber()
export class FeatureSubscriber extends BaseEntityEventSubscriber<Feature> {
	/**
	 * Indicates that this subscriber only listen to Feature events.
	 */
	listenTo() {
		return Feature;
	}

	/**
	 * Called after an entity is loaded from the database.
	 *
	 * @param entity - The loaded Feature entity.
	 */
	async afterEntityLoad(entity: Feature): Promise<void> {
		try {
			// Set a default status if not present
			entity.status = entity.status ?? shuffle(Object.values(FeatureStatusEnum))[0];

			// Check and set isEnabled based on gauzyToggleFeatures
			entity.isEnabled = isEnabledByDefault(entity.code);

			// Set imageUrl based on the entity's image property
			if (Object.prototype.hasOwnProperty.call(entity, 'image')) {
				await this.setImageUrl(entity);
			}
		} catch (error) {
			console.error('FeatureSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Simulate an asynchronous operation to set the imageUrl.
	 *
	 * @param entity
	 * @returns
	 */
	private setImageUrl(entity: Feature): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation, e.g., fetching fullUrl from a service
				setTimeout(async () => {
					const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
					entity.imageUrl = await store.getProviderInstance().url(entity.image);
					resolve();
				});
			} catch (error) {
				console.error('FeatureSubscriber: Error during the setImageUrl process:', error);
				reject(null);
			}
		});
	}
}

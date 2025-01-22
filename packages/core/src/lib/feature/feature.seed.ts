import { DataSource } from 'typeorm';
import * as chalk from 'chalk';
import * as path from 'path';
import * as rimraf from 'rimraf';
import { ApplicationPluginConfig } from '@gauzy/common';
import { environment as env, DatabaseTypeEnum } from '@gauzy/config';
import { IFeature, IFeatureOrganization, ITenant } from '@gauzy/contracts';
import { DEFAULT_FEATURES } from './default-features';
import { FeatureOrganization } from './feature-organization.entity';
import { Feature } from './feature.entity';
import { copyAssets } from '../core/seeds/utils';
import { getApiPublicPath } from '../core/util';

/**
 * Creates default feature toggles and their hierarchical relationships.
 *
 * This function initializes the default features for a given tenant by cleaning up
 * existing features, creating parent and child features, and saving them in the database.
 *
 * @param {DataSource} dataSource - The database connection or ORM data source.
 * @param {Partial<ApplicationPluginConfig>} config - Application configuration for features.
 * @param {ITenant} tenant - The tenant for which the features will be created.
 * @returns {Promise<IFeature[]>} - A promise resolving to a list of created features.
 */
export const createDefaultFeatureToggle = async (
	dataSource: DataSource,
	config: Partial<ApplicationPluginConfig>,
	tenant: ITenant
): Promise<IFeature[]> => {
	// Clean up existing features
	await cleanFeature(dataSource, config);

	for (const item of DEFAULT_FEATURES) {
		// Create the parent feature
		const feature: IFeature = await createFeature(item, tenant, config);
		const parent = await dataSource.manager.save(feature);

		// Process and save child features, if any
		if (item.children?.length > 0) {
			const featureChildren: IFeature[] = await Promise.all(
				item.children.map(async (child) => {
					const childFeature: IFeature = await createFeature(child, tenant, config);
					childFeature.parent = parent;
					return childFeature;
				})
			);
			await dataSource.manager.save(featureChildren);
		}
	}

	// Retrieve and return all created features
	return await dataSource.getRepository(Feature).find();
};

/**
 * Creates random feature toggles for multiple tenants.
 *
 * This function assigns random feature toggles to organizations associated with multiple tenants.
 *
 * @param {DataSource} dataSource - The database connection or ORM data source.
 * @param {ITenant[]} tenants - A list of tenants for which random feature toggles will be created.
 * @returns {Promise<IFeature[]>} - A promise resolving to a list of all features in the database.
 */
export const createRandomFeatureToggle = async (dataSource: DataSource, tenants: ITenant[]): Promise<IFeature[]> => {
	// Retrieve all features
	const features: IFeature[] = await dataSource.getRepository(Feature).find();
	const featureOrganizations: IFeatureOrganization[] = [];

	// Assign features to tenants
	for (const feature of features) {
		for (const tenant of tenants) {
			const featureOrganization: IFeatureOrganization = new FeatureOrganization({
				isEnabled: feature.isEnabled,
				tenant,
				feature
			});
			featureOrganizations.push(featureOrganization);
		}
	}

	// Save all feature-organization relationships
	await dataSource.manager.save(featureOrganizations);

	// Return the list of features
	return features;
};

/**
 * Creates a new feature entity for the provided tenant and configuration.
 *
 * This function initializes a feature entity using the given item details, associates it
 * with the tenant, and optionally processes and copies related assets (e.g., images).
 *
 * @param {IFeature} item - The feature details including name, code, description, etc.
 * @param {ITenant} tenant - The tenant to associate with the feature.
 * @param {Partial<ApplicationPluginConfig>} config - Configuration for handling assets.
 * @returns {Promise<IFeature>} - A promise resolving to the created feature entity.
 */
async function createFeature(
	item: IFeature,
	tenant: ITenant,
	config: Partial<ApplicationPluginConfig>
): Promise<IFeature> {
	const { name, code, description, image, link, isEnabled, status, icon } = item;
	const feature: IFeature = new Feature({
		name,
		code,
		description,
		image: copyAssets(image, config, 'features'),
		link,
		status,
		icon,
		featureOrganizations: [new FeatureOrganization({ isEnabled, tenant })]
	});
	return feature;
}

/**
 * Cleans up the `feature` and `feature_organization` tables and deletes associated images.
 *
 * This function performs a database cleanup for the feature-related tables based on the database type
 * specified in the configuration. It also removes old feature-related images from the designated directory.
 *
 * @param {DataSource} dataSource - The database connection or ORM data source.
 * @param {Partial<ApplicationPluginConfig>} config - Configuration for the application, including database options.
 * @returns {Promise<void>} - Resolves when the cleanup operation is complete.
 */
async function cleanFeature(dataSource: DataSource, config: Partial<ApplicationPluginConfig>): Promise<void> {
	switch (config.dbConnectionOptions.type) {
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
			await dataSource.query('DELETE FROM feature');
			await dataSource.query('DELETE FROM feature_organization');
			break;
		case DatabaseTypeEnum.postgres:
			await dataSource.query('TRUNCATE TABLE feature RESTART IDENTITY CASCADE');
			await dataSource.query('TRUNCATE TABLE feature_organization RESTART IDENTITY CASCADE');
			break;
		case DatabaseTypeEnum.mysql:
			// -- disable foreign_key_checks to avoid query failing when there is a foreign key in the table
			await dataSource.query('SET foreign_key_checks = 0;');
			await dataSource.query('DELETE FROM feature;');
			await dataSource.query('DELETE FROM feature_organization;');
			await dataSource.query('SET foreign_key_checks = 1;');
			break;
		default:
			throw Error(`
				cannot clean feature, feature_organization tables due to unsupported database type:
				${config.dbConnectionOptions.type}
			`);
	}

	console.log(chalk.green(`CLEANING UP FEATURE IMAGES...`));

	await new Promise((resolve, reject) => {
		// Determine directories based on environment
		const isElectron = env.isElectron;

		// Default public directory for assets
		const publicDir = getApiPublicPath();

		// Determine the base directory for assets
		const dir = isElectron
			? path.resolve(env.gauzyUserPath, 'public/features')
			: path.resolve(config.assetOptions?.assetPublicPath || publicDir, 'features'); // Custom public directory path from configuration.

		console.log('Feature Cleaner -> dir: ' + dir);

		// delete old generated report image
		rimraf(
			`${dir}/!(rimraf|.gitkeep)`,
			() => {
				console.log(chalk.green(`CLEANED UP FEATURE IMAGES`));
				resolve(null);
			},
			() => {
				reject(null);
			}
		);
	});
}

import * as chalk from 'chalk';
import { copyFileSync, mkdirSync } from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import { ApplicationPluginConfig } from '@gauzy/common';
import { ConfigService, environment as env, DatabaseTypeEnum } from '@gauzy/config';
import {
	IFeature,
	IFeatureOrganization,
	ITenant
} from '@gauzy/contracts';
import { DataSource } from 'typeorm';
import { DEFAULT_FEATURES } from './default-features';
import { FeatureOrganization } from './feature-organization.entity';
import { Feature } from './feature.entity';

export const createDefaultFeatureToggle = async (
	dataSource: DataSource,
	config: Partial<ApplicationPluginConfig>,
	tenant: ITenant
) => {
	await cleanFeature(dataSource, config);

	for await (const item of DEFAULT_FEATURES) {
		const feature: IFeature = await createFeature(item, tenant, config);
		const parent = await dataSource.manager.save(feature);

		const { children = [] } = item;
		if (children.length > 0) {
			const featureChildren: IFeature[] = [];

			for await (const child of children) {
				const childFeature: IFeature = await createFeature(child, tenant, config);
				childFeature.parent = parent;
				featureChildren.push(childFeature);
			}

			await dataSource.manager.save(featureChildren);
		}
	}
	return await dataSource.getRepository(Feature).find();
};

export const createRandomFeatureToggle = async (dataSource: DataSource, tenants: ITenant[]) => {
	const features: IFeature[] = await dataSource.getRepository(Feature).find();
	const featureOrganizations: IFeatureOrganization[] = [];

	for await (const feature of features) {
		for await (const tenant of tenants) {
			const { isEnabled } = feature;
			const featureOrganization: IFeatureOrganization = new FeatureOrganization({
				isEnabled,
				tenant,
				feature
			});
			featureOrganizations.push(featureOrganization);
		}
	}

	await dataSource.manager.save(featureOrganizations);
	return features;
};

async function createFeature(item: IFeature, tenant: ITenant, config: Partial<ApplicationPluginConfig>) {
	const { name, code, description, image, link, isEnabled, status, icon } = item;
	const feature: IFeature = new Feature({
		name,
		code,
		description,
		image: copyImage(image, config),
		link,
		status,
		icon,
		featureOrganizations: [
			new FeatureOrganization({
				isEnabled,
				tenant
			})
		]
	});
	return feature;
}

async function cleanFeature(dataSource, config) {
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
		const destDir = 'features';
		const configService = new ConfigService();

		let dir: string;

		if (env.isElectron) {
			dir = path.resolve(env.gauzyUserPath, ...['public', destDir]);
		} else {
			dir = path.join(configService.assetOptions.assetPublicPath, destDir);
		}

		// delete old generated feature image
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

function copyImage(fileName: string, config: Partial<ApplicationPluginConfig>) {
	try {
		const destDir = 'features';

		let dir: string;
		let baseDir: string;

		if (env.isElectron) {
			dir = path.resolve(env.gauzySeedPath, destDir);

			baseDir = path.resolve(env.gauzyUserPath, ...['public']);
		} else {
			if (config.assetOptions.assetPath) {
				dir = path.join(config.assetOptions.assetPath, ...['seed', destDir]);
			} else {
				dir = path.resolve(__dirname, '../../../', ...['apps', 'api', 'src', 'assets', 'seed', destDir]);
			}

			if (config.assetOptions.assetPublicPath) {
				baseDir = config.assetOptions.assetPublicPath;
			} else {
				baseDir = path.resolve(__dirname, '../../../', ...['apps', 'api', 'public']);
			}
		}

		const finalDir = path.join(baseDir, destDir);

		mkdirSync(finalDir, { recursive: true });

		const destFilePath = path.join(destDir, fileName);

		copyFileSync(path.join(dir, fileName), path.join(baseDir, destFilePath));

		return destFilePath;
	} catch (err) {
		console.log(err);
	}
}

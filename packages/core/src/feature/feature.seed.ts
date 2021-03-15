import { Connection } from 'typeorm';
import * as path from 'path';
import { copyFileSync, mkdirSync } from 'fs';
import * as chalk from 'chalk';
import * as rimraf from 'rimraf';
import { ConfigService, environment as env } from '@gauzy/config';
import {
	IFeature,
	IFeatureCreateInput,
	IFeatureOrganization,
	ITenant
} from '@gauzy/contracts';
import { DEFAULT_FEATURES } from './default-features';
import { Tenant } from '../tenant/tenant.entity';
import { Feature } from './feature.entity';
import { FeatureOrganization } from './feature_organization.entity';
import { IPluginConfig } from '@gauzy/common';

export const createDefaultFeatureToggle = async (
	connection: Connection,
	config: IPluginConfig,
	tenant: Tenant
) => {
	await cleanFeature(connection, config);

	DEFAULT_FEATURES.forEach(async (item: IFeatureCreateInput) => {
		const feature: IFeature = createFeature(item, tenant, config);
		const parent = await connection.manager.save(feature);

		const { children = [] } = item;
		if (children.length > 0) {
			const featureChildren: IFeature[] = [];
			children.forEach((child: IFeature) => {
				const childFeature: IFeature = createFeature(
					child,
					tenant,
					config
				);
				childFeature.parent = parent;
				featureChildren.push(childFeature);
			});

			await connection.manager.save(featureChildren);
		}
	});
	return await connection.getRepository(Feature).find();
};

export const createRandomFeatureToggle = async (
	connection: Connection,
	tenants: Tenant[]
) => {
	const features: IFeature[] = await connection.getRepository(Feature).find();

	const featureOrganizations: IFeatureOrganization[] = [];
	features.forEach(async (feature: IFeature) => {
		tenants.forEach((tenant: ITenant) => {
			const { isEnabled } = feature;
			const featureOrganization: IFeatureOrganization = new FeatureOrganization(
				{
					isEnabled,
					tenant,
					feature
				}
			);
			featureOrganizations.push(featureOrganization);
		});
	});

	await connection.manager.save(featureOrganizations);
	return features;
};

function createFeature(item: IFeature, tenant: Tenant, config: IPluginConfig) {
	const {
		name,
		code,
		description,
		image,
		link,
		isEnabled,
		status,
		icon
	} = item;
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

async function cleanFeature(connection, config) {
	if (config.dbConnectionOptions.type === 'sqlite') {
		await connection.query('DELETE FROM feature');
		await connection.query('DELETE FROM feature_organization');
	} else {
		await connection.query(
			'TRUNCATE TABLE feature RESTART IDENTITY CASCADE'
		);
		await connection.query(
			'TRUNCATE TABLE feature_organization RESTART IDENTITY CASCADE'
		);
	}

	console.log(chalk.green(`CLEANING UP FEATURE IMAGES...`));

	await new Promise((resolve, reject) => {
		const destDir = 'features';
		const configService = new ConfigService();

		// console.log('FEATURE SEED -> IS ELECTRON: ' + env.isElectron);

		/*
		console.log(
			'FEATURE SEED -> assetPath: ' + config.assetOptions.assetPath
		);
		console.log(
			'FEATURE SEED -> assetPublicPath: ' +
				config.assetOptions.assetPublicPath
		);
		console.log('FEATURE SEED -> __dirname: ' + __dirname);
		*/

		let dir;

		if (env.isElectron) {
			dir = path.resolve(env.gauzyUserPath, ...['public', destDir]);
		} else {
			dir = path.join(
				configService.assetOptions.assetPublicPath,
				destDir
			);
		}

		// delete old generated report image
		rimraf(
			dir,
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

function copyImage(fileName: string, config: IPluginConfig) {
	try {
		const destDir = 'features';

		let dir;
		let baseDir;

		if (env.isElectron) {
			dir = path.resolve(
				env.gauzyUserPath,
				...['src', 'assets', 'seed', destDir]
			);

			baseDir = path.resolve(env.gauzyUserPath, ...['public']);
		} else {
			if (config.assetOptions.assetPath) {
				dir = path.join(
					config.assetOptions.assetPath,
					...['seed', destDir]
				);
			} else {
				dir = path.resolve(
					__dirname,
					'../../../',
					...['apps', 'api', 'src', 'assets', 'seed', destDir]
				);
			}

			if (config.assetOptions.assetPublicPath) {
				baseDir = config.assetOptions.assetPublicPath;
			} else {
				baseDir = path.resolve(
					__dirname,
					'../../../',
					...['apps', 'api', 'public']
				);
			}
		}

		// console.log('FEATURE SEED -> dir: ' + dir);
		// console.log('FEATURE SEED -> baseDir: ' + baseDir);

		const finalDir = path.join(baseDir, destDir);

		// console.log('FEATURE SEED -> finalDir: ' + finalDir);

		mkdirSync(finalDir, { recursive: true });

		const destFilePath = path.join(destDir, fileName);

		copyFileSync(
			path.join(dir, fileName),
			path.join(baseDir, destFilePath)
		);

		return destFilePath;
	} catch (err) {
		console.log(err);
	}
}

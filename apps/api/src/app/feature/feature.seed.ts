import { Connection } from 'typeorm';
import * as path from 'path';
import { copyFileSync, mkdirSync } from 'fs';
import { environment as env } from '@env-api/environment';
import { DEFAULT_FEATURES } from './default-features';
import { Organization } from '../organization/organization.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Feature } from './feature.entity';
import { IFeatureCreateInput } from '@gauzy/models';

export const createDefaultFeatureToggle = async (
	connection: Connection,
	tenant: Tenant,
	organizations: Organization[]
) => {
	DEFAULT_FEATURES.forEach((item: IFeatureCreateInput) => {
		const { name, code, description, image, link } = item;
		const feature = new Feature({
			name,
			code,
			description,
			image: copyImage(image),
			link
		});
		console.log(feature);
	});
};

function copyImage(fileName: string) {
	try {
		const dir = env.isElectron
			? path.resolve(
					env.gauzyUserPath,
					...['src', 'assets', 'seed', 'features']
			  )
			: path.resolve(
					'.',
					...['apps', 'api', 'src', 'assets', 'seed', 'features']
			  );

		const baseDir = env.isElectron
			? path.resolve(env.gauzyUserPath, ...['public'])
			: path.resolve('.', ...['apps', 'api', 'public']);

		const destDir = 'features';

		mkdirSync(path.join(baseDir, destDir), { recursive: true });

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

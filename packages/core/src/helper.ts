import * as path from 'path';
import { ConfigService, environment } from '@gauzy/config';
import { ServeStaticModuleOptions } from '@nestjs/serve-static';

export async function resolveServeStaticPath(
	configService: ConfigService
): Promise<ServeStaticModuleOptions[]> {
	return [
		{
			rootPath: environment.isElectron
				? path.resolve(environment.gauzyUserPath, 'public')
				: configService.assetOptions.assetPublicPath ||
				  path.resolve(process.cwd(), 'public'),
			serveRoot: '/public/'
		}
	] as ServeStaticModuleOptions[];
}

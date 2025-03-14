import * as path from 'path';
import { environment } from '../environments/environment';

export function resolveHtmlPath(htmlFileName: string, hash: string) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 4200;
    return `http://localhost:${port}#/${hash}`;
  }

  const pathUrl = path.resolve(__dirname, '..', `${htmlFileName}`);
  return pathUrl;
}

export function getApiBaseUrl(configs: any) {
	if (configs.serverUrl) return configs.serverUrl;
	else {
		return configs.port
				? `http://localhost:${configs.port}`
				: `http://localhost:${environment.API_DEFAULT_PORT}`;
	}
};

export function delaySync(duration: number) {
	return new Promise((resolve) => {
		setTimeout(() => resolve(true), duration);
	});
}

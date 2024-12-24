import * as fs from 'fs';
import { IProxyConfig, ISsl } from '@gauzy/contracts';
import { ISslFactory } from '../interfaces/i-server-factory';

export class SslFactory implements ISslFactory {
	public createSslConfig(config: IProxyConfig): ISsl {
		try {
			return {
				key: fs.readFileSync(config.ssl.key, 'utf8'),
				cert: fs.readFileSync(config.ssl.cert, 'utf8')
			};
		} catch (error) {
			console.error('ERROR: Reading SSL configuration:', error);
			throw error;
		}
	}
}

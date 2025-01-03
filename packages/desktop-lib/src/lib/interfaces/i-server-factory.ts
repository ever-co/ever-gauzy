import { IProxyConfig, ISsl } from '@gauzy/contracts';

export interface ISslFactory {
	createSslConfig(config: IProxyConfig): ISsl;
}

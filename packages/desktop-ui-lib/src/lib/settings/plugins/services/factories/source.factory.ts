import { PluginSourceType } from '@gauzy/contracts';
import { ISourceStrategy } from '../../shared/plugin.model';
import { CdnSourceStrategy } from '../strategies/cdn-source.strategy';
import { NpmSourceStrategy } from '../strategies/npm-source.strategy';
import { GauzySourceStrategy } from '../strategies/gauzy-source.strategy';

export class SourceStrategyFactory {
	static getStrategy(type: PluginSourceType): ISourceStrategy {
		switch (type) {
			case PluginSourceType.CDN:
				return new CdnSourceStrategy();
			case PluginSourceType.NPM:
				return new NpmSourceStrategy();
			case PluginSourceType.GAUZY:
				return new GauzySourceStrategy();
			default:
				throw new Error(`Unsupported source type: ${type}`);
		}
	}
}

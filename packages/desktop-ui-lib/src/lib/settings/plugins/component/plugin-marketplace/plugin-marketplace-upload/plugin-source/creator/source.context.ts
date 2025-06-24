import { Injectable } from '@angular/core';
import { PluginSourceType } from '@gauzy/contracts';
import { CdnSourceCreator } from './concretes/cdn-source.creator';
import { GauzySourceCreator } from './concretes/gauzy-source.creator';
import { NpmSourceCreator } from './concretes/npm-source.creator';
import { SourceCreator } from './source.creator';

@Injectable({
	providedIn: 'root'
})
export class SourceContext {
	private creators: Map<PluginSourceType, SourceCreator> = new Map();

	constructor() {
		this.creators.set(PluginSourceType.CDN, new CdnSourceCreator());
		this.creators.set(PluginSourceType.NPM, new NpmSourceCreator());
		this.creators.set(PluginSourceType.GAUZY, new GauzySourceCreator());
	}

	public getCreator(type: PluginSourceType): SourceCreator {
		const creator = this.creators.get(type);
		if (!creator) {
			throw new Error(`No creator found for source type: ${type}`);
		}
		return creator;
	}
}

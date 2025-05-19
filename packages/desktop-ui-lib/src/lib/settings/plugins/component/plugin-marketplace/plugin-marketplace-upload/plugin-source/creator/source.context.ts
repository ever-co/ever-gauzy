import { Injectable } from '@angular/core';
import { FormBuilder } from '@angular/forms';
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

	constructor(fb: FormBuilder) {
		this.creators.set(PluginSourceType.CDN, new CdnSourceCreator(fb));
		this.creators.set(PluginSourceType.NPM, new NpmSourceCreator(fb));
		this.creators.set(PluginSourceType.GAUZY, new GauzySourceCreator(fb));
	}

	public getCreator(type: PluginSourceType): SourceCreator {
		const creator = this.creators.get(type);
		if (!creator) {
			throw new Error(`No creator found for source type: ${type}`);
		}
		return creator;
	}
}

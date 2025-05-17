import { IPlugin, IPluginVersion } from '@gauzy/contracts';
import { Store } from '../../../../services';
import { SourceStrategyFactory } from '../factories/source.factory';

export class PluginFormDataBuilder {
	private formData: FormData = new FormData();
	private commonData: { organizationId: string; tenantId: string };

	constructor(private store: Store) {
		this.commonData = {
			organizationId: this.store.organizationId,
			tenantId: this.store.tenantId
		};
	}

	public withPluginData(plugin: Partial<IPlugin>): this {
		const pluginData = {
			...(plugin.id && { id: plugin.id }),
			name: plugin.name,
			description: plugin.description,
			type: plugin.type,
			status: plugin.status,
			author: plugin.author,
			license: plugin.license,
			homepage: plugin.homepage,
			repository: plugin.repository,
			...this.commonData,
			version: plugin.version ? this.buildVersionData(plugin.version) : undefined
		};

		this.appendFilteredData('plugin', pluginData);
		return this;
	}

	public withVersionData(version: IPluginVersion): this {
		const versionData = this.buildVersionData(version);
		this.appendFilteredData('version', versionData);
		return this;
	}

	private buildVersionData(version: IPluginVersion) {
		return {
			...(version.id && { id: version.id }),
			number: version.number,
			changelog: version.changelog,
			releaseDate: new Date(version.releaseDate).toISOString(),
			...this.commonData,
			sources: version.sources?.map((source) => this.buildSourceData(source))
		};
	}

	private buildSourceData(source: any) {
		const strategy = SourceStrategyFactory.getStrategy(source.type);
		return {
			...(source.id && { id: source.id }),
			...strategy.getSourceData(source),
			...this.commonData
		};
	}

	private appendFilteredData(key: string, data: any): void {
		const filtered = Object.fromEntries(Object.entries(data).filter(([_, value]) => value !== undefined));
		this.appendJsonToFormData(key, filtered);
	}

	private appendJsonToFormData(key: string, data: any): void {
		for (const [dataKey, value] of Object.entries(data)) {
			const fullKey = `${key}[${dataKey}]`;
			if (value && typeof value === 'object' && !(value instanceof Date) && !(value instanceof File)) {
				this.appendJsonToFormData(fullKey, value);
			} else {
				const value = data == null ? '' : data;
				this.formData.append(fullKey, value as any);
			}
		}
	}

	public appendFiles(sources: any[] | undefined): this {
		if (!sources) return this;

		for (const source of sources) {
			const strategy = SourceStrategyFactory.getStrategy(source.type);
			strategy.appendToFormData(this.formData, source);
		}
		return this;
	}

	public build(): FormData {
		return this.formData;
	}
}

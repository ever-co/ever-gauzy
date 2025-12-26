import { IPlugin, IPluginSource, IPluginVersion } from '@gauzy/contracts';
import { Store } from '../../../../services';
import { SourceStrategyFactory } from '../factories/source.factory';
import { IPluginPlanCreateInput } from '../plugin-subscription.service';

export class PluginFormDataBuilder {
	private formData: FormData = new FormData();
	private commonData: { organizationId: string; tenantId: string };

	constructor(private store: Store) {
		this.commonData = {
			organizationId: this.store.organizationId,
			tenantId: this.store.tenantId
		};
	}

	public appendPlugin(plugin: Partial<IPlugin & { subscriptionPlans?: IPluginPlanCreateInput[] }>): this {
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
			requiresSubscription: plugin.requiresSubscription,
			categoryId: plugin.categoryId
		};

		this.appendFiltered(pluginData);
		this.appendVersion(plugin.version, 'version');
		this.appendSource(plugin.version.sources, 'sources', 'version');

		// Append subscription plans if provided
		if (plugin.subscriptionPlans && plugin.subscriptionPlans.length > 0) {
			this.appendSubscriptionPlans(plugin.subscriptionPlans);
		}

		return this;
	}

	public appendVersion(version: IPluginVersion, key?: string): this {
		if (version) {
			const versionData = this.buildVersionData(version);
			this.appendFiltered(versionData, key);

			if (!key) {
				this.appendSource(version.sources, 'sources');
			}
		}
		return this;
	}

	public appendSource(data: IPluginSource | IPluginSource[], key?: string, parentKey?: string): this {
		key = parentKey ? `${parentKey}[${key}]` : key;

		if (Array.isArray(data)) {
			const sourceData = data.map((source) => this.buildSourceData(source));
			this.appendFiltered(sourceData, key);
		} else if (data) {
			const sourceData = this.buildSourceData(data);
			this.appendFiltered(sourceData, key);
		}

		return this;
	}

	public appendSubscriptionPlans(plans: IPluginPlanCreateInput[]): this {
		if (plans && plans.length > 0) {
			const plansData = plans.filter(Boolean).map((plan) => this.buildSubscriptionPlanData(plan));
			this.appendFiltered(plansData, 'subscriptionPlans');
		}
		return this;
	}

	private buildVersionData(version: IPluginVersion) {
		return {
			...(version.id && { id: version.id }),
			number: version.number,
			changelog: version.changelog,
			releaseDate: this.toISOString(version.releaseDate),
			...this.commonData
		};
	}

	private buildSourceData(source: IPluginSource) {
		const strategy = SourceStrategyFactory.getStrategy(source.type);
		const commonData = {
			type: source.type,
			architecture: source.architecture,
			operatingSystem: source.operatingSystem
		};
		return {
			...(source.id && { id: source.id }),
			...commonData,
			...this.commonData,
			...strategy.getSourceData(source)
		};
	}

	private buildSubscriptionPlanData(plan: IPluginPlanCreateInput) {
		return {
			...(plan.id && { id: plan.id }),
			type: plan.type,
			name: plan.name,
			description: plan.description,
			price: plan.price,
			currency: plan.currency,
			billingPeriod: plan.billingPeriod,
			features: plan.features,
			limitations: plan.limitations,
			trialDays: plan.trialDays,
			setupFee: plan.setupFee,
			discountPercentage: plan.discountPercentage,
			isPopular: plan.isPopular,
			isRecommended: plan.isRecommended
		};
	}

	private toISOString(date: Date | undefined): string {
		return new Date(date ?? Date.now()).toISOString();
	}

	private appendFiltered<T>(data: T, key?: string): void {
		const filtered = Object.fromEntries(Object.entries(data).filter(([_, value]) => value !== undefined));
		this.appendJsonToFormData(filtered, key);
	}

	private appendJsonToFormData<T>(data: T, parentKey?: string): void {
		if (data && typeof data === 'object' && !(data instanceof Date) && !(data instanceof File)) {
			Object.keys(data).forEach((key) => {
				this.appendJsonToFormData(data[key], parentKey ? `${parentKey}[${key}]` : key);
			});
		} else {
			const value = data == null ? '' : data;
			this.formData.append(parentKey, value as any);
		}
	}

	public appendFiles(sources: IPluginSource[] | undefined): this {
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

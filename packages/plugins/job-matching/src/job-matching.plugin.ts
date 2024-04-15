
import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { EmployeeJobPresetModule, forFeatureEntities } from './employee-job-preset/employee-job-preset.module';
import { JobPreset } from './employee-job-preset/job-preset.entity';

@Plugin({
	imports: [EmployeeJobPresetModule],
	entities: [...forFeatureEntities],
	providers: [],
	configuration: (config: ApplicationPluginConfig) => {
		config.customFields.Employee.push({
			propertyPath: 'jobPresets',
			type: 'relation',
			relationType: 'many-to-many',
			entity: JobPreset,
			inverseSide: (it: JobPreset) => it.employees
		});
		return config;
	}
})
export class JobMatchingPlugin implements IOnPluginBootstrap, IOnPluginDestroy {

	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	constructor() { }

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${JobMatchingPlugin.name} is being bootstrapped...`);
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${JobMatchingPlugin.name} is being destroyed...`);
		}
	}
}

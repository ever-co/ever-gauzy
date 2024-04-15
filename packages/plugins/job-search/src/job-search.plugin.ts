
import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { ApplicationPluginConfig } from '@gauzy/common';
import { EmployeeJobPostModule } from './employee-job/employee-job.module';
import { EmployeeJobPresetModule, entities } from './employee-job-preset/employee-job-preset.module';
import { JobPreset } from './employee-job-preset/job-preset.entity';

@Plugin({
	imports: [EmployeeJobPostModule, EmployeeJobPresetModule],
	entities: [...entities],
	configuration: (config: ApplicationPluginConfig) => {
		// Configuration object for custom fields in the Employee entity.
		config.customFields.Employee.push({
			propertyPath: 'jobPresets',
			type: 'relation',
			relationType: 'many-to-many',
			entity: JobPreset,
			inverseSide: (it: JobPreset) => it.employees
		});
		return config;
	},
	providers: []
})
export class JobSearchPlugin implements IOnPluginBootstrap, IOnPluginDestroy {

	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	constructor() { }

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${JobSearchPlugin.name} is being bootstrapped...`);
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(`${JobSearchPlugin.name} is being destroyed...`);
		}
	}

	/**
	 * Seed default data using the Help Center seeder service.
	 * This method is intended to be invoked during the default seed phase of the plugin lifecycle.
	 */
	async onPluginDefaultSeed() {
		try {
			if (this.logEnabled) {
				console.log(chalk.green(`Default data seeded successfully for ${JobSearchPlugin.name}.`));
			}
		} catch (error) {
			console.error(chalk.red(`Error seeding default data for ${JobSearchPlugin.name}:`, error));
		}
	}

	/**
	 * Seed random data using the Help Center seeder service.
	 * This method is intended to be invoked during the random seed phase of the plugin lifecycle.
	 */
	async onPluginRandomSeed() {
		try {
			if (this.logEnabled) {
				console.log(chalk.green(`Random data seeded successfully for ${JobSearchPlugin.name}.`));
			}
		} catch (error) {
			console.error(chalk.red(`Error seeding random data for ${JobSearchPlugin.name}:`, error));
		}
	}
}

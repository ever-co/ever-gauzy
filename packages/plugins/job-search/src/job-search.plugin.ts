
import * as chalk from 'chalk';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy, IOnPluginSeedable } from '@gauzy/plugin';
import { SeederModule } from '@gauzy/core';
import { ApplicationPluginConfig } from '@gauzy/common';
import { EmployeeJobPostModule } from './employee-job/employee-job.module';
import { EmployeeJobPresetModule, entities } from './employee-job-preset/employee-job-preset.module';
import { JobPreset } from './employee-job-preset/job-preset.entity';
import { JobSeederService } from './employee-job-preset/job-seeder.service';

@Plugin({
	imports: [EmployeeJobPostModule, EmployeeJobPresetModule, SeederModule],
	entities: [...entities],
	configuration: (config: ApplicationPluginConfig) => {
		// Configuration object for custom fields in the Employee entity.
		config.customFields.Employee.push({
			propertyPath: 'jobPresets',
			type: 'relation',
			relationType: 'many-to-many',
			pivotTable: 'employee_job_preset',
			joinColumn: 'jobPresetId',
			inverseJoinColumn: 'employeeId',
			entity: JobPreset,
			inverseSide: (it: JobPreset) => it.employees
		});
		return config;
	},
	providers: [JobSeederService]
})
export class JobSearchPlugin implements IOnPluginBootstrap, IOnPluginDestroy, IOnPluginSeedable {

	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	constructor(private readonly jobSeederService: JobSeederService) { }

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
	 * Seed default data for the plugin.
	 */
	async onPluginDefaultSeed() {
		try {
			await this.jobSeederService.seedDefaultJobsData();

			if (this.logEnabled) {
				console.log(chalk.green(`Default data seeded successfully for ${JobSearchPlugin.name}.`));
			}
		} catch (error) {
			console.error(chalk.red(`Error seeding default data for ${JobSearchPlugin.name}:`, error));
		}
	}

	/**
	 * Seed random data for the plugin.
	 */
	async onPluginRandomSeed() {
		try {
			// Add your random data seeding logic here

			if (this.logEnabled) {
				console.log(chalk.green(`Random data seeded successfully for ${JobSearchPlugin.name}.`));
			}
		} catch (error) {
			console.error(chalk.red(`Error seeding random data for ${JobSearchPlugin.name}:`, error));
		}
	}
}

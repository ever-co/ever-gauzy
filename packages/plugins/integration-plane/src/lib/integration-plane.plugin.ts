import { ApplicationPluginConfig } from '@gauzy/common';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';
import { PlaneModule } from './plane.module';

@Plugin({
	imports: [PlaneModule],
	entities: [],
	configuration: (config: ApplicationPluginConfig) => {
		return config;
	}
})
export class IntegrationPlanePlugin implements IOnPluginBootstrap, IOnPluginDestroy {
	private logEnabled = true;

	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log('IntegrationPlanePlugin is being bootstrapped...');
		}
	}

	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log('IntegrationPlanePlugin is being destroyed...');
		}
	}
}

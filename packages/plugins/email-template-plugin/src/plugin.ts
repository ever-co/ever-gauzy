import { CorePlugin, IOnPluginBootstrap, IOnPluginDestroy } from '@gauzy/plugin';

/**
 * @example
 */
@CorePlugin({
	imports: []
})
export class EmailTemplatePlugin implements IOnPluginBootstrap, IOnPluginDestroy {

	constructor() { }

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		console.log('EmailTemplatePlugin is being bootstrapped...');
		// Your existing logic here...

		// For example, log the completion of the method.
		console.log('EmailTemplatePlugin bootstrap completed.');
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		console.log('EmailTemplatePlugin is being destroyed...');
		// Your existing logic here...

		// For example, log the completion of the method.
		console.log('EmailTemplatePlugin destruction completed.');
	}
}

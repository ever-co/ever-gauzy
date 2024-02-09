import { GauzyCorePlugin, IOnPluginBootstrap, IOnPluginDestroy } from "@gauzy/plugin";

@GauzyCorePlugin({})
export class SentryPlugin implements IOnPluginBootstrap, IOnPluginDestroy {

    // We disable by default additional logging for each event to avoid cluttering the logs
    private logEnabled = true;

    /**
     * Called when the plugin is being initialized.
     */
    onPluginBootstrap(): void | Promise<void> {
        if (this.logEnabled) {
            console.log('SentryPlugin is being bootstrapped...');
            // Your existing logic here...
        }
    }

    /**
     * Called when the plugin is being destroyed.
     */
    onPluginDestroy(): void | Promise<void> {
        if (this.logEnabled) {
            console.log('SentryPlugin is being destroyed...');
            // Your existing logic here...
        }
    }
}

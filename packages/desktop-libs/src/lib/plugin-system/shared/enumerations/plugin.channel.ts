export enum PluginChannel {
	LOAD = 'plugins::load',
	INITIALIZE = 'plugins::initialize',
	DISPOSE = 'plugins::dispose',
	DOWNLOAD = 'plugin::download',
	ACTIVATE = 'plugin::activate',
	DEACTIVATE = 'plugin::deactivate',
	UNINSTALL = 'plugin::uninstall',
	STATUS = 'plugin::status'
}

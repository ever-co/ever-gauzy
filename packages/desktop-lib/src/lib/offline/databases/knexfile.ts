import { ProviderFactory } from './provider-factory';

// This file is the knex CLI migration config entry point.
// It must only be executed by the knex CLI tool, never imported at runtime
// by the Electron main process — doing so would open a DB connection before app.ready.
if (!process.env.GAUZY_USER_PATH) {
	throw new Error(
		'[knexfile] GAUZY_USER_PATH is not set. ' +
			'This file must only be used by the knex CLI after app.ready has fired.'
	);
}

const provider = ProviderFactory.instance;

module.exports = provider.config;

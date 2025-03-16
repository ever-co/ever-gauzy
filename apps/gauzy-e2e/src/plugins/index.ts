// ***********************************************************
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

const browserify = require('@cypress/browserify-preprocessor');
const cucumber = require('cypress-cucumber-preprocessor').default;
const resolve = require('resolve');

module.exports = (on, config) => {
	// `on` is used to hook into various events Cypress emits
	// `config` is the resolved Cypress config

	// Preprocess Typescript file using Nx helper
	const options = {
		...browserify.defaultOptions,
		typescript: resolve.sync('typescript', { baseDir: config.projectRoot })
	};

	on('file:preprocessor', cucumber(options));
};

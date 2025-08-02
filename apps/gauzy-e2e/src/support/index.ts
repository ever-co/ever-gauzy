// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

//testing library
import '@testing-library/cypress/add-commands';
/// <reference types="@testing-library/cypress" />

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Cypress {
		interface Chainable {
			// Add custom commands here
			visitAndWait(url: string, options?: Partial<VisitOptions>): Chainable<JQuery<HTMLElement>>;
			reloadAndWait(): Chainable<JQuery<HTMLElement>>;
		}
	}
}

// Import commands.js using ES2015 syntax:
import './commands';
import './cyCommands';

Cypress.on('uncaught:exception', (err, runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    return false;
});

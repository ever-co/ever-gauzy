import { API_WAIT_TIMEOUT, NON_CRITICAL_REQUESTS, UI_SETTLE_DELAY } from './Base/utils/constants';

Cypress.Commands.add('visitAndWait', (url: string, options = {}) => {
	let pendingXHRs = 0;

	cy.intercept('/api/**', (req) => {
		// Skip non-critical requests
		if (NON_CRITICAL_REQUESTS.some((pattern: RegExp) => pattern.test(req.url))) {
			return;
		}
		pendingXHRs++;
		req.on('response', () => {
			pendingXHRs--;
		});
	}).as('anyApiRequest');

	cy.visit(url, options);

	cy.wait('@anyApiRequest');

	// Function to check pending XHRs
	const checkPendingXHRs = () => {
		if (pendingXHRs > 0) {
			cy.log(`Waiting for ${pendingXHRs} pending API requests...`);
			return false;
		}
		return true;
	};

	// Wait for network idle using then() instead of should()
	cy.wrap(null, { timeout: API_WAIT_TIMEOUT })
		.then(() => {
			return new Cypress.Promise((resolve) => {
				const check = () => {
					if (checkPendingXHRs()) {
						resolve();
					} else {
						setTimeout(check, 100);
					}
				};
				check();
			});
		})
		.then(() => {
			// Let any UI effects settle
			return cy.wait(UI_SETTLE_DELAY);
		});
});

let pendingXHRs = 0;
const API_WAIT_TIMEOUT = 30000;
const UI_SETTLE_DELAY = 1000;

const NON_CRITICAL_REQUESTS = [/\/api\/timesheet\/statistics/, /\/api\/timesheet\/time-log/];
let lastTag = '';

export const interceptAllApiRequests = () => {
	pendingXHRs = 0;
	const tag = Date.now().toString().slice(0, 5);
	lastTag = tag;
	cy.intercept('/api/**', (req) => {
		// Skip non-critical requests
		if (NON_CRITICAL_REQUESTS.some((pattern: RegExp) => pattern.test(req.url))) {
			return;
		}
		pendingXHRs++;
		req.on('response', () => {
			pendingXHRs--;
		});
	}).as(`anyApiRequest-${tag}`);
};

export const waitForAllApiRequests = () => {
	cy.wait(`@anyApiRequest-${lastTag}`);

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
};

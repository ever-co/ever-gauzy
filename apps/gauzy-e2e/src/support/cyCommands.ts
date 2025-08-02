import { interceptAllApiRequests, waitForAllApiRequests } from './Base/utils';

Cypress.Commands.add('visitAndWait', (url: string, options?: Partial<Cypress.VisitOptions>) => {
	interceptAllApiRequests();
	cy.visit(url, options);
	waitForAllApiRequests();
});

Cypress.Commands.add('reloadAndWait', () => {
	interceptAllApiRequests();
	cy.reload();
	waitForAllApiRequests();
});

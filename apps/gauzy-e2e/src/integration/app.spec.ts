import { getGreeting } from '../support/app.po';

describe('gauzy', () => {
	beforeEach(() => cy.visit('/'));

	it('should display welcome message', () => {
		getGreeting().contains('Welcome to gauzy!');
	});
});

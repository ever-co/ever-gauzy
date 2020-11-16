export const getTitle = () => {
	return cy.title();
};

export const verifyText = (loc, data) => {
	cy.get(loc, { timeout: 40000 })
		.invoke('text')
		.then((text) => {
			expect(text).to.include(data);
		});
};

export const verifyTextByIndex = (loc, data, index) => {
	cy.get(loc)
		.eq(index)
		.invoke('text')
		.then((text) => {
			expect(text).to.include(data);
		});
};

export const clickButton = (loc) => {
	cy.get(loc, { timeout: 40000 }).click();
};

export const clickElementByText = (loc, data) => {
	cy.contains(loc, data).click();
};

export const enterInput = (loc, data) => {
	cy.get(loc, { timeout: 40000 }).type(data);
};

export const wait = (loc) => {
	cy.wait(loc);
};

export const clearField = (loc) => {
	cy.get(loc).clear();
};

export const urlChanged = () => {
	cy.url();
};

export const verifyElementIsVisible = (loc) => {
	cy.get(loc, { timeout: 40000 }).should('be.visible');
};

export const clickButtonByIndex = (loc, index) => {
	cy.get(loc, { timeout: 60000 }).eq(index).click({ force: true });
};

export const enterInputConditionally = (loc, data) => {
	cy.get(loc, { timeout: 40000 }).type(`${data}{enter}`);
};

export const clickKeyboardBtnByKeycode = (keycode) => {
	cy.get('body').trigger('keydown', { keyCode: keycode });
};

export const clickElementIfVisible = (loc, index) => {
	cy.get(loc, { timeout: 40000 }).then((option) => {
		if (option.is(':visible')) {
			option.eq(index).trigger('click');
		}
	});
};

export const compareTwoTexts = (loc, text) => {
	cy.get(loc, { timeout: 40000 }).should('contain.text', text);
};

export const getLastElement = (loc) => {
	cy.get(loc, { timeout: 40000 }).last().trigger('click');
};

export const doubleClickOnElement = (loc, index) => {
	cy.get(loc, { timeout: 40000 }).eq(index).dblclick();
};

export const getNotEqualElement = (loc, text) => {
	cy.get(loc, { timeout: 40000 }).should('not.have.text', text);
};

export const waitElementToHide = (loc) => {
	cy.get(loc, { timeout: 40000 }).should('not.exist');
};

export const clickButtonWithDelay = (loc) => {
	cy.wait(5000);
	cy.get(loc, { timeout: 40000 }).click();
};
  
export const clickButtonByText = (text) => {
	cy.get(`button:contains("${text}")`).click({ force: true });
};

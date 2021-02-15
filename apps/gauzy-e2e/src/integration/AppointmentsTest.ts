import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as appointmentsPage from '../support/Base/pages/Appointments.po';
import { AppointmentsPageData } from '../support/Base/pagedata/AppointmentsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';
import * as faker from 'faker';
import * as manageEmployeesPage from '../support/Base/pages/ManageEmployees.po';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

describe('Book public appointment test', () => {
	before(() => {
		firstName = faker.name.firstName();
		lastName = faker.name.lastName();
		username = faker.internet.userName();
		password = faker.internet.password();
		employeeEmail = faker.internet.email();
		imgUrl = faker.image.avatar();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to book public appointment', () => {
		CustomCommands.addEmployee(
			manageEmployeesPage,
			firstName,
			lastName,
			username,
			employeeEmail,
			password,
			imgUrl
		);
		cy.visit('/#/pages/employees/appointments');
		appointmentsPage.bookPublicAppointmentButtonVisible();
		appointmentsPage.clickBookPublicAppointmentButton(
			AppointmentsPageData.bookAppointmentButton
		);
		appointmentsPage.employeeSelectVisible();
		appointmentsPage.clickEmployeeSelect();
		appointmentsPage.employeeDropdownVisible();
		appointmentsPage.selectEmployeeFromDropdown(`${firstName} ${lastName}`);
		appointmentsPage.bookAppointmentButtonVisible();
		appointmentsPage.clickBookAppointmentButton();
		appointmentsPage.selectButtonVisible();
		appointmentsPage.clickSelectButton(0);
		appointmentsPage.verifyHeader(AppointmentsPageData.header);
		appointmentsPage.verifyEmployee(`${firstName} ${lastName}`);
	});
});

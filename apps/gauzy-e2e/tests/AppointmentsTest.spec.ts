import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as appointmentsPage from './support/pages/Appointments.po';
import { AppointmentsPageData } from '../src/support/Base/pagedata/AppointmentsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';
import { faker } from '@faker-js/faker';
import * as manageEmployeesPage from './support/pages/ManageEmployees.po';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

test.describe('Book public appointment test', () => {
	test('Book public appointment test', async () => {
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.username();
		password = faker.internet.password();
		employeeEmail = faker.internet.exampleEmail();
		imgUrl = faker.image.avatar();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to book public appointment', async () => {
			await CustomCommands.addEmployee(
				manageEmployeesPage,
				firstName,
				lastName,
				username,
				employeeEmail,
				password,
				imgUrl
			);
			await getPage().goto('/#/pages/employees/appointments');
			await appointmentsPage.bookPublicAppointmentButtonVisible();
			await appointmentsPage.clickBookPublicAppointmentButton(AppointmentsPageData.bookAppointmentButton);
			await appointmentsPage.employeeDropdownVisible();
			await appointmentsPage.clickEmployeeDropdown();
			await appointmentsPage.selectEmployeeFromDropdown(`${firstName} ${lastName}`);
			await appointmentsPage.bookAppointmentButtonVisible();
			await appointmentsPage.clickBookAppointmentButton();
			await appointmentsPage.selectButtonVisible();
			await appointmentsPage.clickSelectButton(0);
			await appointmentsPage.verifyHeader(AppointmentsPageData.header);
			await appointmentsPage.verifyEmployee(`${firstName} ${lastName}`);
		});
	});
});

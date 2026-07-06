import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as appointmentsPage from '../../support/pages/Appointments.po';
import { AppointmentsPageData } from '../../../src/support/Base/pagedata/AppointmentsPageData';
import { CustomCommands } from '../../support/commands';
import { faker } from '@faker-js/faker';
import * as manageEmployeesPage from '../../support/pages/ManageEmployees.po';

// Converted 1:1 from the plain AppointmentsTest.spec.ts: the single test() -> one Scenario, its single
// test.step() -> one When step whose body is the verbatim call sequence (verification folded in), so
// runtime behaviour is identical to the already-CI-tested spec. The faker-generated cross-step vars are
// hoisted to module scope and initialised at the start of the (only) step's body. The `Given I am logged
// in as the default user` Background step is defined once in common.steps.ts.

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';

When('I book a public appointment', async () => {
	firstName = faker.person.firstName();
	lastName = faker.person.lastName();
	username = faker.internet.username();
	password = faker.internet.password();
	employeeEmail = faker.internet.exampleEmail();
	imgUrl = faker.image.avatar();

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

import { test } from './support/fixtures';
import { CustomCommands } from './support/commands';
import { faker } from '@faker-js/faker';
import * as loginPage from './support/pages/Login.po';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationTagsPage from './support/pages/OrganizationTags.po';
import * as organizationProjectsPage from './support/pages/OrganizationProjects.po';
import * as manageEmployeesPage from './support/pages/ManageEmployees.po';
import * as clientsPage from './support/pages/Clients.po';
import * as contactsLeadsPage from './support/pages/ContactsLeads.po';
import * as organizationTeamsPage from './support/pages/OrganizationTeams.po';
import * as addTaskPage from './support/pages/AddTasks.po';
import * as addOrganizationPage from './support/pages/AddOrganization.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import { OrganizationProjectsPageData } from '../src/support/Base/pagedata/OrganizationProjectsPageData';
import { ContactsLeadsPageData } from '../src/support/Base/pagedata/ContactsLeadsPageData';
import { OrganizationTeamsPageData } from '../src/support/Base/pagedata/OrganizationTeamsPageData';
import { AddTasksPageData } from '../src/support/Base/pagedata/AddTasksPageData';
import { ClientsData } from '../src/support/Base/pagedata/ClientsPageData';
import { AddOrganizationPageData } from '../src/support/Base/pagedata/AddOrganizationPageData';

// Triage driver (not part of the suite): DRIVE_FLOW=addProject npx playwright test _drive
// Runs login + a single shared CustomCommands flow so we can iterate on it in isolation.
test('drive', async () => {
	const flow = process.env.DRIVE_FLOW || '';
	await CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	const fullName = faker.person.fullName();
	const email = faker.internet.email();
	const city = faker.location.city();
	const postcode = faker.location.zipCode();
	const street = faker.location.streetAddress();
	const website = faker.internet.url();
	if (flow === 'addTag') await CustomCommands.addTag(organizationTagsPage, OrganizationTagsPageData);
	if (flow === 'addProject') await CustomCommands.addProject(organizationProjectsPage, OrganizationProjectsPageData);
	if (flow === 'addEmployee')
		await CustomCommands.addEmployee(
			manageEmployeesPage,
			faker.person.firstName(),
			faker.person.lastName(),
			faker.internet.username(),
			faker.internet.exampleEmail(),
			faker.internet.password(),
			faker.image.avatar()
		);
	if (flow === 'addClient')
		await CustomCommands.addClient(clientsPage, fullName, email, website, city, postcode, street, ClientsData);
	if (flow === 'addContact')
		await CustomCommands.addContact(fullName, email, city, postcode, street, website, contactsLeadsPage, ContactsLeadsPageData);
	if (flow === 'addTeam') await CustomCommands.addTeam(organizationTeamsPage, OrganizationTeamsPageData);
	if (flow === 'addTask') await CustomCommands.addTask(addTaskPage, AddTasksPageData);
	if (flow === 'addOrganization')
		await CustomCommands.addOrganization(addOrganizationPage, faker.company.name(), AddOrganizationPageData, faker.number.int(1000), street);
});

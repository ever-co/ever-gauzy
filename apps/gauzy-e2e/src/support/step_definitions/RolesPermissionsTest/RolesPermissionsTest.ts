import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import { RolesPermissionsPageData } from '../../Base/pagedata/RolesPermissionsPageData';
import * as rolesPermissionsPage from '../../Base/pages/RolesPermissions.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let checked = 'be.checked';
let notChecked = 'not.checked';

// Login with email
Given('Login with default credentials and visit Settings roles page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/settings/roles', { timeout: pageLoadTimeout });
});

// Super admin roles and permissions
And('User can see roles dropdown', () => {
	rolesPermissionsPage.rolesDropdownVisible();
});

When('User click on roles dropdown', () => {
	rolesPermissionsPage.clickRolesDropdown();
});

Then('User can see roles dropdown options', () => {
	rolesPermissionsPage.rolesDropdownOptionVisible();
});

And('User can select Super admin role from dropdown options', () => {
	rolesPermissionsPage.selectRoleFromDropdown(
		RolesPermissionsPageData.superAdmin
	);
});

And('User can verify Super admin general roles and permissions', () => {
	rolesPermissionsPage.verifyState(0, checked);
	rolesPermissionsPage.verifyState(1, checked);
	rolesPermissionsPage.verifyState(2, checked);
	rolesPermissionsPage.verifyState(3, checked);
	rolesPermissionsPage.verifyState(4, checked);
	rolesPermissionsPage.verifyState(5, checked);
	rolesPermissionsPage.verifyState(6, checked);
	rolesPermissionsPage.verifyState(7, checked);
	rolesPermissionsPage.verifyState(8, checked);
	rolesPermissionsPage.verifyState(9, checked);
	rolesPermissionsPage.verifyState(10, checked);
	rolesPermissionsPage.verifyState(11, checked);
	rolesPermissionsPage.verifyState(12, checked);
	rolesPermissionsPage.verifyState(13, checked);
	rolesPermissionsPage.verifyState(14, checked);
	rolesPermissionsPage.verifyState(15, checked);
	rolesPermissionsPage.verifyState(16, checked);
	rolesPermissionsPage.verifyState(17, checked);
	rolesPermissionsPage.verifyState(18, checked);
	rolesPermissionsPage.verifyState(19, checked);
	rolesPermissionsPage.verifyState(20, checked);
	rolesPermissionsPage.verifyState(21, checked);
	rolesPermissionsPage.verifyState(22, checked);
	rolesPermissionsPage.verifyState(23, checked);
	rolesPermissionsPage.verifyState(24, checked);
	rolesPermissionsPage.verifyState(25, checked);
	rolesPermissionsPage.verifyState(26, checked);
	rolesPermissionsPage.verifyState(27, checked);
	rolesPermissionsPage.verifyState(28, checked);
	rolesPermissionsPage.verifyState(29, checked);
	rolesPermissionsPage.verifyState(30, checked);
	rolesPermissionsPage.verifyState(31, checked);
	rolesPermissionsPage.verifyState(32, checked);
	rolesPermissionsPage.verifyState(33, checked);
	rolesPermissionsPage.verifyState(34, checked);
	rolesPermissionsPage.verifyState(35, checked);
	rolesPermissionsPage.verifyState(36, checked);
	rolesPermissionsPage.verifyState(37, checked);
	rolesPermissionsPage.verifyState(38, checked);
	rolesPermissionsPage.verifyState(39, checked);
	rolesPermissionsPage.verifyState(40, checked);
	rolesPermissionsPage.verifyState(41, checked);
	rolesPermissionsPage.verifyState(42, checked);
	rolesPermissionsPage.verifyState(43, checked);
	rolesPermissionsPage.verifyState(44, checked);
	rolesPermissionsPage.verifyState(45, checked);
	rolesPermissionsPage.verifyState(46, checked);
	rolesPermissionsPage.verifyState(47, checked);
	rolesPermissionsPage.verifyState(48, checked);
	rolesPermissionsPage.verifyState(49, checked);
	rolesPermissionsPage.verifyState(50, checked);
	rolesPermissionsPage.verifyState(51, notChecked);
	rolesPermissionsPage.verifyState(52, checked);
});

And('User can verify Super admin administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(53, checked);
	rolesPermissionsPage.verifyState(54, checked);
	rolesPermissionsPage.verifyState(55, checked);
	rolesPermissionsPage.verifyState(56, checked);
	rolesPermissionsPage.verifyState(57, checked);
	rolesPermissionsPage.verifyState(58, checked);
	rolesPermissionsPage.verifyState(59, checked);
	rolesPermissionsPage.verifyState(60, checked);
	rolesPermissionsPage.verifyState(61, checked);
	rolesPermissionsPage.verifyState(62, checked);
	rolesPermissionsPage.verifyState(63, checked);
	rolesPermissionsPage.verifyState(64, checked);
	rolesPermissionsPage.verifyState(65, checked);
	rolesPermissionsPage.verifyState(66, checked);
	rolesPermissionsPage.verifyState(67, checked);
	rolesPermissionsPage.verifyState(68, checked);
	rolesPermissionsPage.verifyState(69, checked);
	rolesPermissionsPage.verifyState(70, checked);
	rolesPermissionsPage.verifyState(71, checked);
	rolesPermissionsPage.verifyState(72, checked);
	rolesPermissionsPage.verifyState(73, checked);
	rolesPermissionsPage.verifyState(74, checked);
	rolesPermissionsPage.verifyState(75, checked);
	rolesPermissionsPage.verifyState(76, checked);
	rolesPermissionsPage.verifyState(77, checked);
	rolesPermissionsPage.verifyState(78, checked);
	rolesPermissionsPage.verifyState(79, checked);
	rolesPermissionsPage.verifyState(80, checked);
	rolesPermissionsPage.verifyState(81, checked);
	rolesPermissionsPage.verifyState(82, checked);
	rolesPermissionsPage.verifyState(83, checked);
	rolesPermissionsPage.verifyState(84, checked);
	rolesPermissionsPage.verifyState(85, checked);
	rolesPermissionsPage.verifyState(86, checked);
	rolesPermissionsPage.verifyState(87, checked);
	rolesPermissionsPage.verifyState(88, checked);
	rolesPermissionsPage.verifyState(89, checked);
	rolesPermissionsPage.verifyState(90, checked);
	rolesPermissionsPage.verifyState(91, checked);
	rolesPermissionsPage.verifyState(92, checked);
	rolesPermissionsPage.verifyState(93, checked);
	rolesPermissionsPage.verifyState(94, notChecked);
	rolesPermissionsPage.verifyState(95, checked);
	rolesPermissionsPage.verifyState(96, checked);
	rolesPermissionsPage.verifyState(97, checked);
	rolesPermissionsPage.verifyState(98, checked);
	rolesPermissionsPage.verifyState(99, checked);
	rolesPermissionsPage.verifyState(100, checked);
});

// Admin roles and permissions
And('User can see roles dropdown', () => {
	rolesPermissionsPage.rolesDropdownVisible();
});

When('User click on roles dropdown', () => {
	rolesPermissionsPage.clickRolesDropdown();
});

Then('User can see roles dropdown options', () => {
	rolesPermissionsPage.rolesDropdownOptionVisible();
});

And('User can select Admin role from dropdown options', () => {
	rolesPermissionsPage.selectRoleByIndex(1);
});

And('User can verify Admin general roles and permissions', () => {
	rolesPermissionsPage.verifyState(0, checked);
	rolesPermissionsPage.verifyState(1, checked);
	rolesPermissionsPage.verifyState(2, checked);
	rolesPermissionsPage.verifyState(3, checked);
	rolesPermissionsPage.verifyState(4, checked);
	rolesPermissionsPage.verifyState(5, checked);
	rolesPermissionsPage.verifyState(6, checked);
	rolesPermissionsPage.verifyState(7, checked);
	rolesPermissionsPage.verifyState(8, checked);
	rolesPermissionsPage.verifyState(9, checked);
	rolesPermissionsPage.verifyState(10, checked);
	rolesPermissionsPage.verifyState(11, checked);
	rolesPermissionsPage.verifyState(12, checked);
	rolesPermissionsPage.verifyState(13, checked);
	rolesPermissionsPage.verifyState(14, checked);
	rolesPermissionsPage.verifyState(15, checked);
	rolesPermissionsPage.verifyState(16, checked);
	rolesPermissionsPage.verifyState(17, checked);
	rolesPermissionsPage.verifyState(18, checked);
	rolesPermissionsPage.verifyState(19, checked);
	rolesPermissionsPage.verifyState(20, checked);
	rolesPermissionsPage.verifyState(21, checked);
	rolesPermissionsPage.verifyState(22, checked);
	rolesPermissionsPage.verifyState(23, checked);
	rolesPermissionsPage.verifyState(24, checked);
	rolesPermissionsPage.verifyState(25, checked);
	rolesPermissionsPage.verifyState(26, checked);
	rolesPermissionsPage.verifyState(27, checked);
	rolesPermissionsPage.verifyState(28, checked);
	rolesPermissionsPage.verifyState(29, checked);
	rolesPermissionsPage.verifyState(30, checked);
	rolesPermissionsPage.verifyState(31, checked);
	rolesPermissionsPage.verifyState(32, checked);
	rolesPermissionsPage.verifyState(33, checked);
	rolesPermissionsPage.verifyState(34, notChecked);
	rolesPermissionsPage.verifyState(35, checked);
	rolesPermissionsPage.verifyState(36, checked);
	rolesPermissionsPage.verifyState(37, checked);
	rolesPermissionsPage.verifyState(38, checked);
	rolesPermissionsPage.verifyState(39, checked);
	rolesPermissionsPage.verifyState(40, checked);
	rolesPermissionsPage.verifyState(41, checked);
	rolesPermissionsPage.verifyState(42, checked);
	rolesPermissionsPage.verifyState(43, checked);
	rolesPermissionsPage.verifyState(44, checked);
	rolesPermissionsPage.verifyState(45, checked);
	rolesPermissionsPage.verifyState(46, checked);
	rolesPermissionsPage.verifyState(47, checked);
	rolesPermissionsPage.verifyState(48, checked);
	rolesPermissionsPage.verifyState(49, checked);
	rolesPermissionsPage.verifyState(50, checked);
	rolesPermissionsPage.verifyState(51, notChecked);
	rolesPermissionsPage.verifyState(52, checked);
});

And('User can verify Admin administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(53, checked);
	rolesPermissionsPage.verifyState(54, notChecked);
	rolesPermissionsPage.verifyState(55, notChecked);
	rolesPermissionsPage.verifyState(56, checked);
	rolesPermissionsPage.verifyState(57, checked);
	rolesPermissionsPage.verifyState(58, checked);
	rolesPermissionsPage.verifyState(59, checked);
	rolesPermissionsPage.verifyState(60, checked);
	rolesPermissionsPage.verifyState(61, checked);
	rolesPermissionsPage.verifyState(62, checked);
	rolesPermissionsPage.verifyState(63, checked);
	rolesPermissionsPage.verifyState(64, checked);
	rolesPermissionsPage.verifyState(65, checked);
	rolesPermissionsPage.verifyState(66, checked);
	rolesPermissionsPage.verifyState(67, checked);
	rolesPermissionsPage.verifyState(68, checked);
	rolesPermissionsPage.verifyState(69, checked);
	rolesPermissionsPage.verifyState(70, checked);
	rolesPermissionsPage.verifyState(71, checked);
	rolesPermissionsPage.verifyState(72, checked);
	rolesPermissionsPage.verifyState(73, checked);
	rolesPermissionsPage.verifyState(74, checked);
	rolesPermissionsPage.verifyState(75, checked);
	rolesPermissionsPage.verifyState(76, notChecked);
	rolesPermissionsPage.verifyState(77, checked);
	rolesPermissionsPage.verifyState(78, notChecked);
	rolesPermissionsPage.verifyState(79, checked);
	rolesPermissionsPage.verifyState(80, checked);
	rolesPermissionsPage.verifyState(81, checked);
	rolesPermissionsPage.verifyState(82, checked);
	rolesPermissionsPage.verifyState(83, checked);
	rolesPermissionsPage.verifyState(84, checked);
	rolesPermissionsPage.verifyState(85, checked);
	rolesPermissionsPage.verifyState(86, checked);
	rolesPermissionsPage.verifyState(87, checked);
	rolesPermissionsPage.verifyState(88, checked);
	rolesPermissionsPage.verifyState(89, checked);
	rolesPermissionsPage.verifyState(90, checked);
	rolesPermissionsPage.verifyState(91, checked);
	rolesPermissionsPage.verifyState(92, checked);
	rolesPermissionsPage.verifyState(93, checked);
	rolesPermissionsPage.verifyState(94, checked);
	rolesPermissionsPage.verifyState(95, checked);
	rolesPermissionsPage.verifyState(96, checked);
	rolesPermissionsPage.verifyState(97, checked);
	rolesPermissionsPage.verifyState(98, checked);
	rolesPermissionsPage.verifyState(99, checked);
	rolesPermissionsPage.verifyState(100, notChecked);
});

// Data Entry roles and permissions
And('User can see roles dropdown', () => {
	rolesPermissionsPage.rolesDropdownVisible();
});

When('User click on roles dropdown', () => {
	rolesPermissionsPage.clickRolesDropdown();
});

Then('User can see roles dropdown options', () => {
	rolesPermissionsPage.rolesDropdownOptionVisible();
});

And('User can select Data Entry role from dropdown options', () => {
	rolesPermissionsPage.selectRoleFromDropdown(
		RolesPermissionsPageData.dataEntry
	);
});

And('User can verify Data Entry general roles and permissions', () => {
	rolesPermissionsPage.verifyState(0, notChecked);
	rolesPermissionsPage.verifyState(1, checked);
	rolesPermissionsPage.verifyState(2, checked);
	rolesPermissionsPage.verifyState(3, checked);
	rolesPermissionsPage.verifyState(4, checked);
	rolesPermissionsPage.verifyState(5, notChecked);
	rolesPermissionsPage.verifyState(6, notChecked);
	rolesPermissionsPage.verifyState(7, checked);
	rolesPermissionsPage.verifyState(8, checked);
	rolesPermissionsPage.verifyState(9, notChecked);
	rolesPermissionsPage.verifyState(10, notChecked);
	rolesPermissionsPage.verifyState(11, notChecked);
	rolesPermissionsPage.verifyState(12, notChecked);
	rolesPermissionsPage.verifyState(13, notChecked);
	rolesPermissionsPage.verifyState(14, notChecked);
	rolesPermissionsPage.verifyState(15, notChecked);
	rolesPermissionsPage.verifyState(16, notChecked);
	rolesPermissionsPage.verifyState(17, notChecked);
	rolesPermissionsPage.verifyState(18, notChecked);
	rolesPermissionsPage.verifyState(19, notChecked);
	rolesPermissionsPage.verifyState(20, notChecked);
	rolesPermissionsPage.verifyState(21, notChecked);
	rolesPermissionsPage.verifyState(22, notChecked);
	rolesPermissionsPage.verifyState(23, notChecked);
	rolesPermissionsPage.verifyState(24, notChecked);
	rolesPermissionsPage.verifyState(25, checked);
	rolesPermissionsPage.verifyState(26, checked);
	rolesPermissionsPage.verifyState(27, checked);
	rolesPermissionsPage.verifyState(28, checked);
	rolesPermissionsPage.verifyState(29, notChecked);
	rolesPermissionsPage.verifyState(30, checked);
	rolesPermissionsPage.verifyState(31, checked);
	rolesPermissionsPage.verifyState(32, checked);
	rolesPermissionsPage.verifyState(33, notChecked);
	rolesPermissionsPage.verifyState(34, notChecked);
	rolesPermissionsPage.verifyState(35, checked);
	rolesPermissionsPage.verifyState(36, notChecked);
	rolesPermissionsPage.verifyState(37, notChecked);
	rolesPermissionsPage.verifyState(38, notChecked);
	rolesPermissionsPage.verifyState(39, checked);
	rolesPermissionsPage.verifyState(40, notChecked);
	rolesPermissionsPage.verifyState(41, notChecked);
	rolesPermissionsPage.verifyState(42, notChecked);
	rolesPermissionsPage.verifyState(43, notChecked);
	rolesPermissionsPage.verifyState(44, notChecked);
	rolesPermissionsPage.verifyState(45, notChecked);
	rolesPermissionsPage.verifyState(46, notChecked);
	rolesPermissionsPage.verifyState(47, notChecked);
	rolesPermissionsPage.verifyState(48, notChecked);
	rolesPermissionsPage.verifyState(49, notChecked);
	rolesPermissionsPage.verifyState(50, notChecked);
	rolesPermissionsPage.verifyState(51, notChecked);
	rolesPermissionsPage.verifyState(52, notChecked);
});

And('User can verify Data Entry administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(53, notChecked);
	rolesPermissionsPage.verifyState(54, notChecked);
	rolesPermissionsPage.verifyState(55, notChecked);
	rolesPermissionsPage.verifyState(56, notChecked);
	rolesPermissionsPage.verifyState(57, notChecked);
	rolesPermissionsPage.verifyState(58, notChecked);
	rolesPermissionsPage.verifyState(59, notChecked);
	rolesPermissionsPage.verifyState(60, notChecked);
	rolesPermissionsPage.verifyState(61, notChecked);
	rolesPermissionsPage.verifyState(62, notChecked);
	rolesPermissionsPage.verifyState(63, notChecked);
	rolesPermissionsPage.verifyState(64, notChecked);
	rolesPermissionsPage.verifyState(65, notChecked);
	rolesPermissionsPage.verifyState(66, notChecked);
	rolesPermissionsPage.verifyState(67, notChecked);
	rolesPermissionsPage.verifyState(68, notChecked);
	rolesPermissionsPage.verifyState(69, notChecked);
	rolesPermissionsPage.verifyState(70, notChecked);
	rolesPermissionsPage.verifyState(71, notChecked);
	rolesPermissionsPage.verifyState(72, notChecked);
	rolesPermissionsPage.verifyState(73, notChecked);
	rolesPermissionsPage.verifyState(74, checked);
	rolesPermissionsPage.verifyState(75, notChecked);
	rolesPermissionsPage.verifyState(76, notChecked);
	rolesPermissionsPage.verifyState(77, notChecked);
	rolesPermissionsPage.verifyState(78, notChecked);
	rolesPermissionsPage.verifyState(79, checked);
	rolesPermissionsPage.verifyState(80, notChecked);
	rolesPermissionsPage.verifyState(81, notChecked);
	rolesPermissionsPage.verifyState(82, notChecked);
	rolesPermissionsPage.verifyState(83, notChecked);
	rolesPermissionsPage.verifyState(84, notChecked);
	rolesPermissionsPage.verifyState(85, notChecked);
	rolesPermissionsPage.verifyState(86, notChecked);
	rolesPermissionsPage.verifyState(87, notChecked);
	rolesPermissionsPage.verifyState(88, notChecked);
	rolesPermissionsPage.verifyState(89, notChecked);
	rolesPermissionsPage.verifyState(90, notChecked);
	rolesPermissionsPage.verifyState(91, notChecked);
	rolesPermissionsPage.verifyState(92, notChecked);
	rolesPermissionsPage.verifyState(93, notChecked);
	rolesPermissionsPage.verifyState(94, notChecked);
	rolesPermissionsPage.verifyState(95, notChecked);
	rolesPermissionsPage.verifyState(96, notChecked);
	rolesPermissionsPage.verifyState(97, notChecked);
	rolesPermissionsPage.verifyState(98, notChecked);
	rolesPermissionsPage.verifyState(99, notChecked);
	rolesPermissionsPage.verifyState(100, notChecked);
});

// Employee roles and permissions
And('User can see roles dropdown', () => {
	rolesPermissionsPage.rolesDropdownVisible();
});

When('User click on roles dropdown', () => {
	rolesPermissionsPage.clickRolesDropdown();
});

Then('User can see roles dropdown options', () => {
	rolesPermissionsPage.rolesDropdownOptionVisible();
});

And('User can select Employee role from dropdown options', () => {
	rolesPermissionsPage.selectRoleFromDropdown(
		RolesPermissionsPageData.employee
	);
});

And('User can verify Employee general roles and permissions', () => {
	rolesPermissionsPage.verifyState(0, checked);
	rolesPermissionsPage.verifyState(1, notChecked);
	rolesPermissionsPage.verifyState(2, notChecked);
	rolesPermissionsPage.verifyState(3, notChecked);
	rolesPermissionsPage.verifyState(4, notChecked);
	rolesPermissionsPage.verifyState(5, checked);
	rolesPermissionsPage.verifyState(6, checked);
	rolesPermissionsPage.verifyState(7, notChecked);
	rolesPermissionsPage.verifyState(8, notChecked);
	rolesPermissionsPage.verifyState(9, checked);
	rolesPermissionsPage.verifyState(10, checked);
	rolesPermissionsPage.verifyState(11, checked);
	rolesPermissionsPage.verifyState(12, checked);
	rolesPermissionsPage.verifyState(13, checked);
	rolesPermissionsPage.verifyState(14, notChecked);
	rolesPermissionsPage.verifyState(15, notChecked);
	rolesPermissionsPage.verifyState(16, notChecked);
	rolesPermissionsPage.verifyState(17, notChecked);
	rolesPermissionsPage.verifyState(18, notChecked);
	rolesPermissionsPage.verifyState(19, checked);
	rolesPermissionsPage.verifyState(20, checked);
	rolesPermissionsPage.verifyState(21, checked);
	rolesPermissionsPage.verifyState(22, checked);
	rolesPermissionsPage.verifyState(23, notChecked);
	rolesPermissionsPage.verifyState(24, notChecked);
	rolesPermissionsPage.verifyState(25, checked);
	rolesPermissionsPage.verifyState(26, checked);
	rolesPermissionsPage.verifyState(27, checked);
	rolesPermissionsPage.verifyState(28, checked);
	rolesPermissionsPage.verifyState(29, notChecked);
	rolesPermissionsPage.verifyState(30, checked);
	rolesPermissionsPage.verifyState(31, notChecked);
	rolesPermissionsPage.verifyState(32, notChecked);
	rolesPermissionsPage.verifyState(33, notChecked);
	rolesPermissionsPage.verifyState(34, checked);
	rolesPermissionsPage.verifyState(35, notChecked);
	rolesPermissionsPage.verifyState(36, notChecked);
	rolesPermissionsPage.verifyState(37, notChecked);
	rolesPermissionsPage.verifyState(38, notChecked);
	rolesPermissionsPage.verifyState(39, notChecked);
	rolesPermissionsPage.verifyState(40, notChecked);
	rolesPermissionsPage.verifyState(41, notChecked);
	rolesPermissionsPage.verifyState(42, notChecked);
	rolesPermissionsPage.verifyState(43, notChecked);
	rolesPermissionsPage.verifyState(44, notChecked);
	rolesPermissionsPage.verifyState(45, notChecked);
	rolesPermissionsPage.verifyState(46, notChecked);
	rolesPermissionsPage.verifyState(47, checked);
	rolesPermissionsPage.verifyState(48, notChecked);
	rolesPermissionsPage.verifyState(49, notChecked);
	rolesPermissionsPage.verifyState(50, checked);
	rolesPermissionsPage.verifyState(51, checked);
	rolesPermissionsPage.verifyState(52, checked);
});

And('User can verify Employee administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(53, checked);
	rolesPermissionsPage.verifyState(54, checked);
	rolesPermissionsPage.verifyState(55, notChecked);
	rolesPermissionsPage.verifyState(56, checked);
	rolesPermissionsPage.verifyState(57, notChecked);
	rolesPermissionsPage.verifyState(58, notChecked);
	rolesPermissionsPage.verifyState(59, checked);
	rolesPermissionsPage.verifyState(60, notChecked);
	rolesPermissionsPage.verifyState(61, checked);
	rolesPermissionsPage.verifyState(62, notChecked);
	rolesPermissionsPage.verifyState(63, notChecked);
	rolesPermissionsPage.verifyState(64, notChecked);
	rolesPermissionsPage.verifyState(65, notChecked);
	rolesPermissionsPage.verifyState(66, notChecked);
	rolesPermissionsPage.verifyState(67, notChecked);
	rolesPermissionsPage.verifyState(68, notChecked);
	rolesPermissionsPage.verifyState(69, notChecked);
	rolesPermissionsPage.verifyState(70, notChecked);
	rolesPermissionsPage.verifyState(71, notChecked);
	rolesPermissionsPage.verifyState(72, notChecked);
	rolesPermissionsPage.verifyState(73, notChecked);
	rolesPermissionsPage.verifyState(74, notChecked);
	rolesPermissionsPage.verifyState(75, notChecked);
	rolesPermissionsPage.verifyState(76, notChecked);
	rolesPermissionsPage.verifyState(77, notChecked);
	rolesPermissionsPage.verifyState(78, checked);
	rolesPermissionsPage.verifyState(79, notChecked);
	rolesPermissionsPage.verifyState(80, checked);
	rolesPermissionsPage.verifyState(81, checked);
	rolesPermissionsPage.verifyState(82, notChecked);
	rolesPermissionsPage.verifyState(83, checked);
	rolesPermissionsPage.verifyState(84, checked);
	rolesPermissionsPage.verifyState(85, notChecked);
	rolesPermissionsPage.verifyState(86, notChecked);
	rolesPermissionsPage.verifyState(87, notChecked);
	rolesPermissionsPage.verifyState(88, notChecked);
	rolesPermissionsPage.verifyState(89, notChecked);
	rolesPermissionsPage.verifyState(90, notChecked);
	rolesPermissionsPage.verifyState(91, notChecked);
	rolesPermissionsPage.verifyState(92, notChecked);
	rolesPermissionsPage.verifyState(93, notChecked);
	rolesPermissionsPage.verifyState(94, checked);
	rolesPermissionsPage.verifyState(95, notChecked);
	rolesPermissionsPage.verifyState(96, checked);
	rolesPermissionsPage.verifyState(97, checked);
	rolesPermissionsPage.verifyState(98, checked);
	rolesPermissionsPage.verifyState(99, checked);
	rolesPermissionsPage.verifyState(100, notChecked);
});

// Candidate roles and permissions
And('User can see roles dropdown', () => {
	rolesPermissionsPage.rolesDropdownVisible();
});

When('User click on roles dropdown', () => {
	rolesPermissionsPage.clickRolesDropdown();
});

Then('User can see roles dropdown options', () => {
	rolesPermissionsPage.rolesDropdownOptionVisible();
});

And('User can select Candidate role from dropdown options', () => {
	rolesPermissionsPage.selectRoleFromDropdown(
		RolesPermissionsPageData.candidate
	);
});

And('User can verify Candidate general roles and permissions', () => {
	rolesPermissionsPage.verifyState(0, checked);
	rolesPermissionsPage.verifyState(1, notChecked);
	rolesPermissionsPage.verifyState(2, notChecked);
	rolesPermissionsPage.verifyState(3, notChecked);
	rolesPermissionsPage.verifyState(4, notChecked);
	rolesPermissionsPage.verifyState(5, notChecked);
	rolesPermissionsPage.verifyState(6, notChecked);
	rolesPermissionsPage.verifyState(7, notChecked);
	rolesPermissionsPage.verifyState(8, notChecked);
	rolesPermissionsPage.verifyState(9, notChecked);
	rolesPermissionsPage.verifyState(10, checked);
	rolesPermissionsPage.verifyState(11, notChecked);
	rolesPermissionsPage.verifyState(12, notChecked);
	rolesPermissionsPage.verifyState(13, checked);
	rolesPermissionsPage.verifyState(14, notChecked);
	rolesPermissionsPage.verifyState(15, notChecked);
	rolesPermissionsPage.verifyState(16, notChecked);
	rolesPermissionsPage.verifyState(17, notChecked);
	rolesPermissionsPage.verifyState(18, notChecked);
	rolesPermissionsPage.verifyState(19, notChecked);
	rolesPermissionsPage.verifyState(20, notChecked);
	rolesPermissionsPage.verifyState(21, notChecked);
	rolesPermissionsPage.verifyState(22, notChecked);
	rolesPermissionsPage.verifyState(23, notChecked);
	rolesPermissionsPage.verifyState(24, notChecked);
	rolesPermissionsPage.verifyState(25, notChecked);
	rolesPermissionsPage.verifyState(25, notChecked);
	rolesPermissionsPage.verifyState(27, notChecked);
	rolesPermissionsPage.verifyState(28, notChecked);
	rolesPermissionsPage.verifyState(29, notChecked);
	rolesPermissionsPage.verifyState(30, notChecked);
	rolesPermissionsPage.verifyState(31, notChecked);
	rolesPermissionsPage.verifyState(32, notChecked);
	rolesPermissionsPage.verifyState(33, notChecked);
	rolesPermissionsPage.verifyState(34, notChecked);
	rolesPermissionsPage.verifyState(35, notChecked);
	rolesPermissionsPage.verifyState(36, checked);
	rolesPermissionsPage.verifyState(37, notChecked);
	rolesPermissionsPage.verifyState(38, notChecked);
	rolesPermissionsPage.verifyState(39, notChecked);
	rolesPermissionsPage.verifyState(40, notChecked);
	rolesPermissionsPage.verifyState(41, notChecked);
	rolesPermissionsPage.verifyState(42, notChecked);
	rolesPermissionsPage.verifyState(43, notChecked);
	rolesPermissionsPage.verifyState(44, notChecked);
	rolesPermissionsPage.verifyState(45, notChecked);
	rolesPermissionsPage.verifyState(46, notChecked);
	rolesPermissionsPage.verifyState(47, notChecked);
	rolesPermissionsPage.verifyState(48, notChecked);
	rolesPermissionsPage.verifyState(49, notChecked);
	rolesPermissionsPage.verifyState(50, notChecked);
	rolesPermissionsPage.verifyState(51, notChecked);
	rolesPermissionsPage.verifyState(52, notChecked);
});

And('User can verify Candidate administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(53, notChecked);
	rolesPermissionsPage.verifyState(54, notChecked);
	rolesPermissionsPage.verifyState(55, notChecked);
	rolesPermissionsPage.verifyState(56, notChecked);
	rolesPermissionsPage.verifyState(57, notChecked);
	rolesPermissionsPage.verifyState(58, notChecked);
	rolesPermissionsPage.verifyState(59, notChecked);
	rolesPermissionsPage.verifyState(60, notChecked);
	rolesPermissionsPage.verifyState(61, notChecked);
	rolesPermissionsPage.verifyState(62, notChecked);
	rolesPermissionsPage.verifyState(63, notChecked);
	rolesPermissionsPage.verifyState(64, notChecked);
	rolesPermissionsPage.verifyState(65, notChecked);
	rolesPermissionsPage.verifyState(66, notChecked);
	rolesPermissionsPage.verifyState(67, notChecked);
	rolesPermissionsPage.verifyState(68, notChecked);
	rolesPermissionsPage.verifyState(69, notChecked);
	rolesPermissionsPage.verifyState(70, notChecked);
	rolesPermissionsPage.verifyState(71, notChecked);
	rolesPermissionsPage.verifyState(72, notChecked);
	rolesPermissionsPage.verifyState(73, notChecked);
	rolesPermissionsPage.verifyState(74, notChecked);
	rolesPermissionsPage.verifyState(75, notChecked);
	rolesPermissionsPage.verifyState(76, notChecked);
	rolesPermissionsPage.verifyState(77, notChecked);
	rolesPermissionsPage.verifyState(78, notChecked);
	rolesPermissionsPage.verifyState(79, notChecked);
	rolesPermissionsPage.verifyState(80, notChecked);
	rolesPermissionsPage.verifyState(81, notChecked);
	rolesPermissionsPage.verifyState(82, notChecked);
	rolesPermissionsPage.verifyState(83, notChecked);
	rolesPermissionsPage.verifyState(84, notChecked);
	rolesPermissionsPage.verifyState(85, notChecked);
	rolesPermissionsPage.verifyState(86, notChecked);
	rolesPermissionsPage.verifyState(87, notChecked);
	rolesPermissionsPage.verifyState(88, notChecked);
	rolesPermissionsPage.verifyState(89, notChecked);
	rolesPermissionsPage.verifyState(90, notChecked);
	rolesPermissionsPage.verifyState(91, notChecked);
	rolesPermissionsPage.verifyState(92, notChecked);
	rolesPermissionsPage.verifyState(93, notChecked);
	rolesPermissionsPage.verifyState(94, notChecked);
	rolesPermissionsPage.verifyState(95, notChecked);
	rolesPermissionsPage.verifyState(96, notChecked);
	rolesPermissionsPage.verifyState(97, notChecked);
	rolesPermissionsPage.verifyState(98, notChecked);
	rolesPermissionsPage.verifyState(99, notChecked);
	rolesPermissionsPage.verifyState(100, notChecked);
});

// Manager roles and permissions
And('User can see roles dropdown', () => {
	rolesPermissionsPage.rolesDropdownVisible();
});

When('User click on roles dropdown', () => {
	rolesPermissionsPage.clickRolesDropdown();
});

Then('User can see roles dropdown options', () => {
	rolesPermissionsPage.rolesDropdownOptionVisible();
});

And('User can select Manager role from dropdown options', () => {
	rolesPermissionsPage.selectRoleFromDropdown(
		RolesPermissionsPageData.manager
	);
});

And('User can verify Manager general roles and permissions', () => {
	rolesPermissionsPage.verifyState(0, notChecked);
	rolesPermissionsPage.verifyState(1, notChecked);
	rolesPermissionsPage.verifyState(2, notChecked);
	rolesPermissionsPage.verifyState(3, notChecked);
	rolesPermissionsPage.verifyState(4, notChecked);
	rolesPermissionsPage.verifyState(5, notChecked);
	rolesPermissionsPage.verifyState(6, notChecked);
	rolesPermissionsPage.verifyState(7, notChecked);
	rolesPermissionsPage.verifyState(8, notChecked);
	rolesPermissionsPage.verifyState(9, notChecked);
	rolesPermissionsPage.verifyState(10, notChecked);
	rolesPermissionsPage.verifyState(11, notChecked);
	rolesPermissionsPage.verifyState(12, notChecked);
	rolesPermissionsPage.verifyState(13, notChecked);
	rolesPermissionsPage.verifyState(14, notChecked);
	rolesPermissionsPage.verifyState(15, notChecked);
	rolesPermissionsPage.verifyState(16, notChecked);
	rolesPermissionsPage.verifyState(17, notChecked);
	rolesPermissionsPage.verifyState(18, notChecked);
	rolesPermissionsPage.verifyState(19, notChecked);
	rolesPermissionsPage.verifyState(20, notChecked);
	rolesPermissionsPage.verifyState(21, notChecked);
	rolesPermissionsPage.verifyState(22, notChecked);
	rolesPermissionsPage.verifyState(23, notChecked);
	rolesPermissionsPage.verifyState(24, notChecked);
	rolesPermissionsPage.verifyState(25, notChecked);
	rolesPermissionsPage.verifyState(26, notChecked);
	rolesPermissionsPage.verifyState(27, notChecked);
	rolesPermissionsPage.verifyState(28, notChecked);
	rolesPermissionsPage.verifyState(29, notChecked);
	rolesPermissionsPage.verifyState(30, notChecked);
	rolesPermissionsPage.verifyState(31, notChecked);
	rolesPermissionsPage.verifyState(32, notChecked);
	rolesPermissionsPage.verifyState(33, notChecked);
	rolesPermissionsPage.verifyState(34, notChecked);
	rolesPermissionsPage.verifyState(35, notChecked);
	rolesPermissionsPage.verifyState(36, notChecked);
	rolesPermissionsPage.verifyState(37, notChecked);
	rolesPermissionsPage.verifyState(38, notChecked);
	rolesPermissionsPage.verifyState(39, notChecked);
	rolesPermissionsPage.verifyState(40, notChecked);
	rolesPermissionsPage.verifyState(41, notChecked);
	rolesPermissionsPage.verifyState(42, notChecked);
	rolesPermissionsPage.verifyState(43, notChecked);
	rolesPermissionsPage.verifyState(44, notChecked);
	rolesPermissionsPage.verifyState(45, notChecked);
	rolesPermissionsPage.verifyState(46, notChecked);
	rolesPermissionsPage.verifyState(47, notChecked);
	rolesPermissionsPage.verifyState(48, notChecked);
	rolesPermissionsPage.verifyState(49, notChecked);
	rolesPermissionsPage.verifyState(50, notChecked);
	rolesPermissionsPage.verifyState(51, notChecked);
	rolesPermissionsPage.verifyState(52, notChecked);
});

And('User can verify Manager administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(53, notChecked);
	rolesPermissionsPage.verifyState(54, notChecked);
	rolesPermissionsPage.verifyState(55, notChecked);
	rolesPermissionsPage.verifyState(56, notChecked);
	rolesPermissionsPage.verifyState(57, notChecked);
	rolesPermissionsPage.verifyState(58, notChecked);
	rolesPermissionsPage.verifyState(59, notChecked);
	rolesPermissionsPage.verifyState(60, notChecked);
	rolesPermissionsPage.verifyState(61, notChecked);
	rolesPermissionsPage.verifyState(62, notChecked);
	rolesPermissionsPage.verifyState(63, notChecked);
	rolesPermissionsPage.verifyState(64, notChecked);
	rolesPermissionsPage.verifyState(65, notChecked);
	rolesPermissionsPage.verifyState(66, notChecked);
	rolesPermissionsPage.verifyState(67, notChecked);
	rolesPermissionsPage.verifyState(68, notChecked);
	rolesPermissionsPage.verifyState(69, notChecked);
	rolesPermissionsPage.verifyState(70, notChecked);
	rolesPermissionsPage.verifyState(71, notChecked);
	rolesPermissionsPage.verifyState(72, notChecked);
	rolesPermissionsPage.verifyState(73, notChecked);
	rolesPermissionsPage.verifyState(74, notChecked);
	rolesPermissionsPage.verifyState(75, notChecked);
	rolesPermissionsPage.verifyState(76, notChecked);
	rolesPermissionsPage.verifyState(77, notChecked);
	rolesPermissionsPage.verifyState(78, notChecked);
	rolesPermissionsPage.verifyState(79, notChecked);
	rolesPermissionsPage.verifyState(80, notChecked);
	rolesPermissionsPage.verifyState(81, notChecked);
	rolesPermissionsPage.verifyState(82, notChecked);
	rolesPermissionsPage.verifyState(83, notChecked);
	rolesPermissionsPage.verifyState(84, notChecked);
	rolesPermissionsPage.verifyState(85, notChecked);
	rolesPermissionsPage.verifyState(86, notChecked);
	rolesPermissionsPage.verifyState(87, notChecked);
	rolesPermissionsPage.verifyState(88, notChecked);
	rolesPermissionsPage.verifyState(89, notChecked);
	rolesPermissionsPage.verifyState(90, notChecked);
	rolesPermissionsPage.verifyState(91, notChecked);
	rolesPermissionsPage.verifyState(92, notChecked);
	rolesPermissionsPage.verifyState(93, notChecked);
	rolesPermissionsPage.verifyState(94, notChecked);
	rolesPermissionsPage.verifyState(95, notChecked);
	rolesPermissionsPage.verifyState(96, notChecked);
	rolesPermissionsPage.verifyState(97, notChecked);
	rolesPermissionsPage.verifyState(98, notChecked);
	rolesPermissionsPage.verifyState(99, notChecked);
	rolesPermissionsPage.verifyState(100, notChecked);
});

// Viewer roles and permissions
And('User can see roles dropdown', () => {
	rolesPermissionsPage.rolesDropdownVisible();
});

When('User click on roles dropdown', () => {
	rolesPermissionsPage.clickRolesDropdown();
});

Then('User can see roles dropdown options', () => {
	rolesPermissionsPage.rolesDropdownOptionVisible();
});

And('User can select Viewer role from dropdown options', () => {
	rolesPermissionsPage.selectRoleFromDropdown(
		RolesPermissionsPageData.viewer
	);
});

And('User can verify Viewer general roles and permissions', () => {
	rolesPermissionsPage.verifyState(0, notChecked);
	rolesPermissionsPage.verifyState(1, notChecked);
	rolesPermissionsPage.verifyState(2, notChecked);
	rolesPermissionsPage.verifyState(3, notChecked);
	rolesPermissionsPage.verifyState(4, notChecked);
	rolesPermissionsPage.verifyState(5, notChecked);
	rolesPermissionsPage.verifyState(6, notChecked);
	rolesPermissionsPage.verifyState(7, notChecked);
	rolesPermissionsPage.verifyState(8, notChecked);
	rolesPermissionsPage.verifyState(9, notChecked);
	rolesPermissionsPage.verifyState(10, notChecked);
	rolesPermissionsPage.verifyState(11, notChecked);
	rolesPermissionsPage.verifyState(12, notChecked);
	rolesPermissionsPage.verifyState(13, notChecked);
	rolesPermissionsPage.verifyState(14, notChecked);
	rolesPermissionsPage.verifyState(15, notChecked);
	rolesPermissionsPage.verifyState(16, notChecked);
	rolesPermissionsPage.verifyState(17, notChecked);
	rolesPermissionsPage.verifyState(18, notChecked);
	rolesPermissionsPage.verifyState(19, notChecked);
	rolesPermissionsPage.verifyState(20, notChecked);
	rolesPermissionsPage.verifyState(21, notChecked);
	rolesPermissionsPage.verifyState(22, notChecked);
	rolesPermissionsPage.verifyState(23, notChecked);
	rolesPermissionsPage.verifyState(24, notChecked);
	rolesPermissionsPage.verifyState(25, notChecked);
	rolesPermissionsPage.verifyState(26, notChecked);
	rolesPermissionsPage.verifyState(27, notChecked);
	rolesPermissionsPage.verifyState(28, notChecked);
	rolesPermissionsPage.verifyState(29, notChecked);
	rolesPermissionsPage.verifyState(30, notChecked);
	rolesPermissionsPage.verifyState(31, notChecked);
	rolesPermissionsPage.verifyState(32, notChecked);
	rolesPermissionsPage.verifyState(33, notChecked);
	rolesPermissionsPage.verifyState(34, notChecked);
	rolesPermissionsPage.verifyState(35, notChecked);
	rolesPermissionsPage.verifyState(36, notChecked);
	rolesPermissionsPage.verifyState(37, notChecked);
	rolesPermissionsPage.verifyState(38, notChecked);
	rolesPermissionsPage.verifyState(39, notChecked);
	rolesPermissionsPage.verifyState(40, notChecked);
	rolesPermissionsPage.verifyState(41, notChecked);
	rolesPermissionsPage.verifyState(42, notChecked);
	rolesPermissionsPage.verifyState(43, notChecked);
	rolesPermissionsPage.verifyState(44, notChecked);
	rolesPermissionsPage.verifyState(45, notChecked);
	rolesPermissionsPage.verifyState(46, notChecked);
	rolesPermissionsPage.verifyState(47, notChecked);
	rolesPermissionsPage.verifyState(48, notChecked);
	rolesPermissionsPage.verifyState(49, notChecked);
	rolesPermissionsPage.verifyState(50, notChecked);
	rolesPermissionsPage.verifyState(51, notChecked);
	rolesPermissionsPage.verifyState(52, notChecked);
});

And('User can verify Viewer administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(53, notChecked);
	rolesPermissionsPage.verifyState(54, notChecked);
	rolesPermissionsPage.verifyState(55, notChecked);
	rolesPermissionsPage.verifyState(56, notChecked);
	rolesPermissionsPage.verifyState(57, notChecked);
	rolesPermissionsPage.verifyState(58, notChecked);
	rolesPermissionsPage.verifyState(59, notChecked);
	rolesPermissionsPage.verifyState(60, notChecked);
	rolesPermissionsPage.verifyState(61, notChecked);
	rolesPermissionsPage.verifyState(62, notChecked);
	rolesPermissionsPage.verifyState(63, notChecked);
	rolesPermissionsPage.verifyState(64, notChecked);
	rolesPermissionsPage.verifyState(65, notChecked);
	rolesPermissionsPage.verifyState(66, notChecked);
	rolesPermissionsPage.verifyState(67, notChecked);
	rolesPermissionsPage.verifyState(68, notChecked);
	rolesPermissionsPage.verifyState(69, notChecked);
	rolesPermissionsPage.verifyState(70, notChecked);
	rolesPermissionsPage.verifyState(71, notChecked);
	rolesPermissionsPage.verifyState(72, notChecked);
	rolesPermissionsPage.verifyState(73, notChecked);
	rolesPermissionsPage.verifyState(74, notChecked);
	rolesPermissionsPage.verifyState(75, notChecked);
	rolesPermissionsPage.verifyState(76, notChecked);
	rolesPermissionsPage.verifyState(77, notChecked);
	rolesPermissionsPage.verifyState(78, notChecked);
	rolesPermissionsPage.verifyState(79, notChecked);
	rolesPermissionsPage.verifyState(80, notChecked);
	rolesPermissionsPage.verifyState(81, notChecked);
	rolesPermissionsPage.verifyState(82, notChecked);
	rolesPermissionsPage.verifyState(83, notChecked);
	rolesPermissionsPage.verifyState(84, notChecked);
	rolesPermissionsPage.verifyState(85, notChecked);
	rolesPermissionsPage.verifyState(86, notChecked);
	rolesPermissionsPage.verifyState(87, notChecked);
	rolesPermissionsPage.verifyState(88, notChecked);
	rolesPermissionsPage.verifyState(89, notChecked);
	rolesPermissionsPage.verifyState(90, notChecked);
	rolesPermissionsPage.verifyState(91, notChecked);
	rolesPermissionsPage.verifyState(92, notChecked);
	rolesPermissionsPage.verifyState(93, notChecked);
	rolesPermissionsPage.verifyState(94, notChecked);
	rolesPermissionsPage.verifyState(95, notChecked);
	rolesPermissionsPage.verifyState(96, notChecked);
	rolesPermissionsPage.verifyState(97, notChecked);
	rolesPermissionsPage.verifyState(98, notChecked);
	rolesPermissionsPage.verifyState(99, notChecked);
	rolesPermissionsPage.verifyState(100, notChecked);
});

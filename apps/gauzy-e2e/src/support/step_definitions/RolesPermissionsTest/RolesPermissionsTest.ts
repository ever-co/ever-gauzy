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
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX0, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX1, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX2, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX3, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX4, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX5, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX6, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX7, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX8, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX9, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX0, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX11, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX12, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX13, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX14, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX15, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX16, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX17, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX18, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX19, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX20, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX21, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX22, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX23, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX24, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX25, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX26, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX27, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX28, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX29, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX30, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX31, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX32, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX33, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX34, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX35, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX36, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX37, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX38, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX39, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX40, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX41, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX42, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX43, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX44, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX45, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX46, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX47, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX48, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX49, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX50, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX51, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX52, checked);
});

And('User can verify Super admin administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX53, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX54, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX55, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX56, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX57, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX58, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX59, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX60, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX61, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX62, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX63, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX64, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX65, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX66, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX67, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX68, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX69, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX70, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX71, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX72, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX73, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX74, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX75, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX76, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX77, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX78, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX79, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX80, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX81, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX82, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX83, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX84, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX85, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX86, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX87, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX88, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX89, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX90, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX91, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX92, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX93, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX94, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX95, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX96, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX97, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX98, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX99, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermission100, checked);
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
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX0, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX1, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX2, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX3, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX4, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX5, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX6, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX7, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX8, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX9, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX10, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX11, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX12, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX13, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX14, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX15, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX16, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX17, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX18, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX19, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX20, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX21, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX22, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX23, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX24, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX25, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX26, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX27, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX28, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX29, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX30, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX31, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX32, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX33, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX34, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX35, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX36, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX37, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX38, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX39, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX40, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX41, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX42, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX43, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX44, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX45, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX46, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX47, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX48, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX49, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX50, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX51, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX52, checked);
});

And('User can verify Admin administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX53, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX54, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX55, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX56, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX57, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX58, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX59, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX60, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX61, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX62, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX63, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX64, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX65, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX66, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX67, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX68, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX69, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX70, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX71, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX72, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX73, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX74, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX75, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX76, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX77, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX78, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX79, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX80, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX81, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX82, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX83, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX84, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX85, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX86, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX87, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX88, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX89, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX90, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX91, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX92, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX93, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX94, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX95, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX96, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX97, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX98, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX99, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermission100, notChecked);
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
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX0, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX1, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX2, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX3, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX4, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX5, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX6, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX7, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX8, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX9, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX10, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX11, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX12, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX13, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX14, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX15, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX16, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX17, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX18, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX19, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX20, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX21, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX22, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX23, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX24, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX25, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX26, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX27, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX28, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX29, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX30, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX31, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX32, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX33, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX34, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX35, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX36, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX37, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX38, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX39, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX40, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX41, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX42, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX43, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX44, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX45, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX46, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX47, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX48, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX49, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX50, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX51, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX52, notChecked);
});

And('User can verify Data Entry administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX53, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX54, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX55, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX56, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX57, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX58, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX59, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX60, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX61, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX62, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX63, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX64, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX65, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX66, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX67, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX68, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX69, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX70, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX71, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX72, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX73, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX74, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX75, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX76, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX77, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX78, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX79, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX80, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX81, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX82, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX83, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX84, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX85, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX86, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX87, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX88, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX89, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX90, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX91, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX92, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX93, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX94, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX95, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX96, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX97, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX98, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX99, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermission100, notChecked);
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
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX0, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX1, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX2, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX3, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX4, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX5, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX6, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX7, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX8, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX9, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX10, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX11, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX12, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX13, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX14, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX15, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX16, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX17, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX18, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX19, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX20, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX21, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX22, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX23, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX24, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX25, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX26, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX27, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX28, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX29, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX30, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX31, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX32, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX33, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX34, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX35, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX36, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX37, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX38, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX39, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX40, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX41, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX42, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX43, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX44, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX45, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX46, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX47, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX48, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX49, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX50, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX51, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX52, checked);
});

And('User can verify Employee administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX53, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX54, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX55, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX56, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX57, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX58, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX59, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX60, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX61, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX62, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX63, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX64, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX65, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX66, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX67, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX68, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX69, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX70, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX71, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX72, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX73, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX74, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX75, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX76, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX77, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX78, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX79, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX80, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX81, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX82, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX83, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX84, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX85, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX86, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX87, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX88, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX89, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX90, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX91, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX92, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX93, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX94, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX95, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX96, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX97, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX98, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX99, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermission100, notChecked);
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
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX0, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX1, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX2, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX3, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX4, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX5, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX6, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX7, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX8, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX9, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX10, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX11, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX12, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX13, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX14, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX15, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX16, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX17, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX18, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX19, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX20, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX21, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX22, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX23, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX24, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX25, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX25, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX27, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX28, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX29, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX30, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX31, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX32, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX33, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX34, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX35, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX36, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX37, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX38, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX39, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX40, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX41, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX42, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX43, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX44, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX45, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX46, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX47, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX48, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX49, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX50, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX51, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX52, notChecked);
});

And('User can verify Candidate administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX53, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX54, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX55, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX56, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX57, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX58, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX59, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX60, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX61, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX62, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX63, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX64, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX65, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX66, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX67, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX68, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX69, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX70, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX71, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX72, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX73, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX74, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX75, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX76, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX77, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX78, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX79, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX80, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX81, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX82, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX83, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX84, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX85, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX86, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX87, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX88, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX89, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX90, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX91, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX92, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX93, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX94, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX95, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX96, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX97, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX98, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX99, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermission100, notChecked);
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
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX0, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX1, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX2, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX3, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX4, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX5, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX6, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX7, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX8, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX9, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX10, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX11, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX12, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX13, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX14, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX15, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX16, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX17, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX18, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX19, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX20, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX21, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX22, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX23, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX24, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX25, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX26, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX27, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX28, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX29, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX30, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX31, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX32, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX33, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX34, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX35, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX36, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX37, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX38, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX39, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX40, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX41, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX42, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX43, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX44, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX45, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX46, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX47, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX48, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX49, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX50, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX51, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX52, notChecked);
});

And('User can verify Manager administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX53, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX54, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX55, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX56, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX57, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX58, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX59, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX60, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX61, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX62, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX63, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX64, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX65, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX66, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX67, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX68, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX69, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX70, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX71, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX72, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX73, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX74, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX75, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX76, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX77, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX78, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX79, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX80, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX81, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX82, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX83, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX84, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX85, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX86, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX87, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX88, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX89, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX90, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX91, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX92, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX93, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX94, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX95, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX96, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX97, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX98, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX99, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermission100, notChecked);
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
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX0, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX1, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX2, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX3, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX4, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX5, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX6, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX7, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX8, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionXX9, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX10, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX11, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX12, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX13, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX14, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX15, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX16, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX17, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX18, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX19, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX20, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX21, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX22, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX23, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX24, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX25, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX26, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX27, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX28, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX29, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX30, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX31, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX32, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX33, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX34, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX35, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX36, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX37, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX38, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX39, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX40, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX41, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX42, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX43, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX44, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX45, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX46, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX47, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX48, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX49, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX50, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX51, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX52, notChecked);
});

And('User can verify Viewer administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX53, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX54, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX55, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX56, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX57, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX58, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX59, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX60, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX61, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX62, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX63, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX64, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX65, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX66, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX67, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX68, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX69, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX70, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX71, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX72, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX73, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX74, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX75, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX76, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX77, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX78, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX79, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX80, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX81, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX82, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX83, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX84, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX85, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX86, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX87, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX88, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX89, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX90, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX91, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX92, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX93, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX94, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX95, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX96, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX97, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX98, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermissionX99, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AllowPermission100, notChecked);
});

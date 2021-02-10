import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';
import { RolesPermissionsPageData } from '../support/Base/pagedata/RolesPermissionsPageData';
import * as rolesPermissionsPage from '../support/Base/pages/RolesPermissions.po';

let checked = 'be.checked';
let notChecked = 'not.checked';

describe('Roles and permissions test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Super admin roles and permissions', () => {
		cy.visit('/#/pages/settings/roles');
		rolesPermissionsPage.rolesDropdownVisible();
		rolesPermissionsPage.clickRolesDropdown();
		rolesPermissionsPage.rolesDropdownOptionVisible();
		rolesPermissionsPage.selectRoleFromDropdown(
			RolesPermissionsPageData.superAdmin
		);
		// General
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
		// Administration
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
		rolesPermissionsPage.verifyState(83, notChecked);
		rolesPermissionsPage.verifyState(84, checked);
	});
	it('Admin roles and permissions', () => {
		rolesPermissionsPage.clickRolesDropdown();
		rolesPermissionsPage.rolesDropdownOptionVisible();
		rolesPermissionsPage.selectRoleByIndex(1);
		// General
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
		// Administration
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
		rolesPermissionsPage.verifyState(65, notChecked);
		rolesPermissionsPage.verifyState(66, checked);
		rolesPermissionsPage.verifyState(67, notChecked);
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
		rolesPermissionsPage.verifyState(83, notChecked);
		rolesPermissionsPage.verifyState(84, checked);
	});
	it('Data Entry roles and permissions', () => {
		rolesPermissionsPage.clickRolesDropdown();
		rolesPermissionsPage.rolesDropdownOptionVisible();
		rolesPermissionsPage.selectRoleFromDropdown(
			RolesPermissionsPageData.dataEntry
		);
		// General
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
		// Administration
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
		rolesPermissionsPage.verifyState(63, checked);
		rolesPermissionsPage.verifyState(64, notChecked);
		rolesPermissionsPage.verifyState(65, notChecked);
		rolesPermissionsPage.verifyState(66, notChecked);
		rolesPermissionsPage.verifyState(67, notChecked);
		rolesPermissionsPage.verifyState(68, checked);
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
	});
	it('Employee roles and permissions', () => {
		rolesPermissionsPage.clickRolesDropdown();
		rolesPermissionsPage.rolesDropdownOptionVisible();
		rolesPermissionsPage.selectRoleFromDropdown(
			RolesPermissionsPageData.employee
		);
		// General
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
		rolesPermissionsPage.verifyState(52, notChecked);
		// Administration
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
		rolesPermissionsPage.verifyState(67, checked);
		rolesPermissionsPage.verifyState(68, notChecked);
		rolesPermissionsPage.verifyState(69, checked);
		rolesPermissionsPage.verifyState(70, checked);
		rolesPermissionsPage.verifyState(71, notChecked);
		rolesPermissionsPage.verifyState(72, checked);
		rolesPermissionsPage.verifyState(73, checked);
		rolesPermissionsPage.verifyState(74, notChecked);
		rolesPermissionsPage.verifyState(75, notChecked);
		rolesPermissionsPage.verifyState(76, notChecked);
		rolesPermissionsPage.verifyState(77, notChecked);
		rolesPermissionsPage.verifyState(78, notChecked);
		rolesPermissionsPage.verifyState(79, notChecked);
		rolesPermissionsPage.verifyState(80, notChecked);
		rolesPermissionsPage.verifyState(81, notChecked);
		rolesPermissionsPage.verifyState(82, notChecked);
		rolesPermissionsPage.verifyState(83, checked);
		rolesPermissionsPage.verifyState(84, notChecked);
	});
	it('Candidate roles and permissions', () => {
		rolesPermissionsPage.clickRolesDropdown();
		rolesPermissionsPage.rolesDropdownOptionVisible();
		rolesPermissionsPage.selectRoleFromDropdown(
			RolesPermissionsPageData.candidate
		);
		// General
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
		// Administration
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
	});
	it('Manager roles and permissions', () => {
		rolesPermissionsPage.clickRolesDropdown();
		rolesPermissionsPage.rolesDropdownOptionVisible();
		rolesPermissionsPage.selectRoleFromDropdown(
			RolesPermissionsPageData.manager
		);
		// General
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
		// Administration
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
	});
	it('Viewer roles and permissions', () => {
		rolesPermissionsPage.clickRolesDropdown();
		rolesPermissionsPage.rolesDropdownOptionVisible();
		rolesPermissionsPage.selectRoleFromDropdown(
			RolesPermissionsPageData.viewer
		);
		// General
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
		// Administration
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
	});
	it('Should be able to verify text', () => {
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewAdminDashboard
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewPayments
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditDeletePayments
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewAllExpenses
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditDeleteExpenses
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewAllEmployeeExpenses
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditDeleteEmployeeExpenses
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditDeleteIncomes
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewAllIncomes
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditDeleteProposalsRegister
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewProposalsPage
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewProposalTemplatesPage
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditDeleteProposalTemplates
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewTimeOffPage
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewOrganizationInvites
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createResendDeleteInvites
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewTimeOffPolicy
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.editTimeOffPolicy
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.editTimeOff
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.editApprovalsPolicy
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewApprovalsPolicy
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.editApprovalRequest
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewApprovalRequest
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.accessPrivateProjects
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.editTimeinTimesheet
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewInvoices
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.editInvoicesAdd
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewEstimates
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.editEstimatesAdd
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewAllCandidatesDocuments
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditTask
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditInterview
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditInterviewers
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditDeleteCandidateFeedback
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.managementProduct
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditDeleteTags
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewAllEmails
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewAllEmailsTemplates
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.editOrganizationHelpCenter
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewSalesPipelines
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.editSalesPipelines
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.approveTimesheet
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditSprints
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewSprints
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditProjects
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditContacts
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewContacts
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditTeams
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditContracts
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewEventTypes
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewOrganizationEmployees
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditDeleteOrganizationEmployees
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewOrganizationCandidates
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditDeleteOrganizationCandidates
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewOrganizationUsers
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditDeleteOrganizationUsers
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewAllOrganizations
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.createEditDeleteAllOrganizations
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.changeSelectedEmployee
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.changeSelectedCandidate
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.changeSelectedOrganization
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.changeRolesPermissions
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.editSuperAdminUsers
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.editOrganizationPublicPage
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.tenantAddUserToOrganization
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewIntegrations
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewFileStorage
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewPaymentGateway
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewSMSGateway
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewCustomSMTP
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewImportExport
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewJobEmployees
		);
		rolesPermissionsPage.verifyTextExist(
			RolesPermissionsPageData.viewJobMatching
		);
	});
});

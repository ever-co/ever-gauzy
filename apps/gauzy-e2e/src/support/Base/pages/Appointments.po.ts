import {
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clickButtonByIndex,
	verifyText
} from '../utils/util';
import { AppointmentsPage } from '../pageobjects/AppointmentsPageObject';

export const bookPublicAppointmentButtonVisible = () => {
	verifyElementIsVisible(AppointmentsPage.bookPublicAppointmentButtonCss);
};

export const clickBookPublicAppointmentButton = (text) => {
	clickElementByText(AppointmentsPage.bookPublicAppointmentButtonCss, text);
};

export const employeeSelectVisible = () => {
	verifyElementIsVisible(AppointmentsPage.employeesSelectCss);
};

export const clickEmployeeSelect = () => {
	clickButton(AppointmentsPage.employeesSelectCss);
};

export const employeeDropdownVisible = () => {
	verifyElementIsVisible(AppointmentsPage.employeesDropdownCss);
};

export const selectEmployeeFromDropdown = (text) => {
	clickElementByText(AppointmentsPage.employeesDropdownCss, text);
};

export const bookAppointmentButtonVisible = () => {
	verifyElementIsVisible(AppointmentsPage.bookAppointmentButtonCss);
};

export const clickBookAppointmentButton = () => {
	clickButton(AppointmentsPage.bookAppointmentButtonCss);
};

export const selectButtonVisible = () => {
	verifyElementIsVisible(AppointmentsPage.selectAppointmentButtonCss);
};

export const clickSelectButton = (index) => {
	clickButtonByIndex(AppointmentsPage.selectAppointmentButtonCss, index);
};

export const verifyHeader = (text) => {
	verifyText(AppointmentsPage.headerCss, text);
};

export const verifyEmployee = (text) => {
	verifyText(AppointmentsPage.employeeNameCss, text);
};

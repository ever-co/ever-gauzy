import { Injectable } from '@angular/core';
import moment from 'moment';
import { DefaultValueDateTypeEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-sdk/common';
import { DateRangePickerBuilderService } from '../selector-builder';

@Injectable({
	providedIn: 'root'
})
export class OrganizationSettingService {
	constructor(
		private readonly store: Store,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {}

	/**
	 * Retrieves a date based on the organization settings.
	 * If the organization's default value date type is set to 'END_OF_MONTH',
	 * returns the end of the month for the provided startDate.
	 * If the organization's default value date type is set to 'START_OF_MONTH',
	 * returns the start of the month for the provided startDate.
	 * If the organization's default value date type is not set or is invalid,
	 * returns the current date.
	 * @returns
	 */
	getDateFromOrganizationSettings(): Date {
		const startDate = this.dateRangePickerBuilderService?.selectedDateRange?.startDate ?? new Date();
		if (this.store.selectedOrganization) {
			switch (this.store.selectedOrganization.defaultValueDateType) {
				case DefaultValueDateTypeEnum.END_OF_MONTH: {
					return moment(startDate).endOf('month').toDate();
				}
				case DefaultValueDateTypeEnum.START_OF_MONTH: {
					return moment(startDate).startOf('month').toDate();
				}
				default: {
					return moment().toDate();
				}
			}
		}
		return moment(startDate).toDate();
	}
}

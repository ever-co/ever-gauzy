import { IBasePerTenantAndOrganizationEntityModel, ID, JsonData } from './base-entity.model';
import { ITimeSlot } from './timesheet.model';

export interface ITimeSlotMinute extends IBasePerTenantAndOrganizationEntityModel {
	timeSlot?: ITimeSlot;
	timeSlotId: ID;

	/**
	 * Activity count metrics within the recorded minute.
	 * - `keyboard`: Number of keyboard events
	 * - `mouse`: Number of mouse events
	 * - `location`: Number of movement events
	 */
	keyboard?: number;
	mouse?: number;
	location?: number;

	// Activity timestamp
	datetime: Date;

	/**
	 * Detailed log of keyboard and mouse activity events for the minute,
	 * such as click counts, key presses, or movement traces.
	 */
	kbMouseActivity?: JsonData;

	/**
	 * Raw location-related activity data for the minute, such as GPS movement,
	 * device orientation, or other physical motion events.
	 */
	locationActivity?: JsonData;

	/**
	 * Custom activity data, allowing extensibility for domain-specific metrics
	 * such as app usage, window focus, or custom plugins.
	 */
	customActivity?: JsonData;
}

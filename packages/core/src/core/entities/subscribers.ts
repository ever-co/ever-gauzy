import {
	ActivitySubscriber,
	CandidateSubscriber,
	EmailTemplateSubscriber,
	EmployeeSubscriber,
	FeatureSubscriber,
	ImportHistorySubscriber,
	InvoiceSubscriber,
	OrganizationContactSubscriber,
	OrganizationProjectSubscriber,
	OrganizationSubscriber,
	ReportSubscriber,
	ScreenshotSubscriber,
	TaskSubscriber,
	TenantSubscriber,
	TimeSlotSubscriber,
	UserSubscriber
} from "./internal";

/**
* A map of the core TypeORM Subscribers.
*/
export const coreSubscribers = [
	ActivitySubscriber,
	CandidateSubscriber,
	EmailTemplateSubscriber,
	EmployeeSubscriber,
	FeatureSubscriber,
	ImportHistorySubscriber,
	InvoiceSubscriber,
	OrganizationContactSubscriber,
	OrganizationProjectSubscriber,
	OrganizationSubscriber,
	ReportSubscriber,
	ScreenshotSubscriber,
	TaskSubscriber,
	TenantSubscriber,
	TimeSlotSubscriber,
	UserSubscriber
];

import { 
	ActivitySubscriber,
	CandidateSubscriber,
	EmployeeSubscriber,
	FeatureSubscriber,
	OrganizationContactSubscriber,
	OrganizationSubscriber,
	ReportSubscriber,
	ScreenshotSubscriber,
	TimeSlotSubscriber,
	UserSubscriber
} from "./internal";

/**
* A map of the core TypeORM Subscribers.
*/
export const coreSubscribers = [
	ActivitySubscriber,
	CandidateSubscriber,
	EmployeeSubscriber,
	FeatureSubscriber,
	OrganizationContactSubscriber,
	OrganizationSubscriber,
	ReportSubscriber,
	ScreenshotSubscriber,
	TimeSlotSubscriber,
	UserSubscriber
];

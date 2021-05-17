import { 
	FeatureSubscriber,
	OrganizationSubscriber,
	ScreenshotSubscriber,
	TimeSlotSubscriber,
	UserSubscriber
} from "./internal";

/**
* A map of the core TypeORM Subscribers.
*/
export const coreSubscribers = [
	FeatureSubscriber,
	OrganizationSubscriber,
	ScreenshotSubscriber,
	TimeSlotSubscriber,
	UserSubscriber
];

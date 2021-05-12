import { 
	FeatureSubscriber, 
	ScreenshotSubscriber, 
	TimeSlotSubscriber 
} from "./internal";

/**
* A map of the core TypeORM Subscribers.
*/
export const coreSubscribers = [
	FeatureSubscriber,
	ScreenshotSubscriber,
	TimeSlotSubscriber
];

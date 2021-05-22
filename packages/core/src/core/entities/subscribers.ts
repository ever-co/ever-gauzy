import { CandidateSubscriber } from "candidate/candidate.subscriber";
import { 
	ActivitySubscriber,
	FeatureSubscriber,
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
	FeatureSubscriber,
	OrganizationSubscriber,
	ReportSubscriber,
	ScreenshotSubscriber,
	TimeSlotSubscriber,
	UserSubscriber
];

import { Subject } from 'rxjs/Subject';
import { Subscription } from 'rxjs/Subscription';

export class EventListener {
	eventName: string = null;
	events: Subject<Event> = null;
	eventsSubscription: Subscription = null;
	teardownCallback: () => void = null;
}

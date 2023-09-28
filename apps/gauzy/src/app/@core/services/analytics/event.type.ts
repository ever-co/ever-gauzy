interface UserCreatedEvent {
	eventType: 'UserCreated';
	userId: string;
	email: string;
}

interface ButtonClickedEvent {
	eventType: 'ButtonClicked';
	url: string;
	periodicity: string;
}

interface PageViewEvent {
	eventType: 'PageView';
	url: string;
	periodicity: string;
}

interface PageCreatedEvent {
	eventType: 'PageCreated';
	slug: string;
}

interface UserUpgradedEvent {
	eventType: 'UserUpgraded';
	email: string;
}

interface UserSignedInEvent {
	eventType: 'UserSignedIn';
	email: string;
}

type JitsuAnalyticsEvents =
	| UserCreatedEvent
	| ButtonClickedEvent
	| PageViewEvent
	| PageCreatedEvent
	| UserUpgradedEvent
	| UserSignedInEvent;

export default JitsuAnalyticsEvents;

export enum JitsuAnalyticsEventsEnum {
	USER_CREATED = 'User Created',
	BUTTON_CLICKED = 'Button_Clicked',
	PAGE_VIEW = 'Page_View',
	PAGE_CREATED = 'Page Created',
}

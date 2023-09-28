interface UserCreatedEvent {
	eventType: 'User Created';
	userId: string;
	email: string;
}

interface ButtonClickedEvent {
	eventType: 'Button_Clicked';
	url: string;
	periodicity: string;
}

interface PageViewEvent {
	eventType: 'Page_View';
	url: string;
	periodicity: string;
}

interface PageCreatedEvent {
	eventType: 'Page Created';
	slug: string;
}

interface UserUpgradedEvent {
	eventType: 'User Upgraded';
	email: string;
}

interface UserSignedInEvent {
	eventType: 'User Signed In';
}

interface UserVercelBetaEvent {
	eventType: 'User Vercel Beta';
}

type JitsuAnalyticsEvents =
	| UserCreatedEvent
	| ButtonClickedEvent
	| PageViewEvent
	| PageCreatedEvent
	| UserUpgradedEvent
	| UserSignedInEvent
	| UserVercelBetaEvent;

export default JitsuAnalyticsEvents;

export enum JitsuAnalyticsEventsEnum {
	USER_CREATED = 'User Created',
	BUTTON_CLICKED = 'Button_Clicked',
	PAGE_VIEW = 'Page_View',
	PAGE_CREATED = 'Page Created',
}

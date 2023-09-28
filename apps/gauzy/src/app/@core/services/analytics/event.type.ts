interface IUserCreatedEvent {
	eventType: 'UserCreated';
	userId: string;
	email: string;
}

interface IButtonClickedEvent {
	eventType: 'ButtonClicked';
	url: string;
	userId: string;
	userEmail: string;
}

interface IMenuItemClickedEvent extends IButtonClickedEvent {
	menuItemName: string;
}

interface IPageViewEvent {
	eventType: 'PageView';
	url: string;
	periodicity: string;
}

interface IPageCreatedEvent {
	eventType: 'PageCreated';
	slug: string;
}

interface IUserUpgradedEvent {
	eventType: 'UserUpgraded';
	email: string;
}

interface IUserClickDownloadAppEvent {
	eventType: 'UserClickDownloadApp';
	email: string;
}

interface IUserSignedInEvent {
	eventType: 'UserSignedIn';
	email: string;
}

type JitsuAnalyticsEvents =
	| IUserCreatedEvent
	| IButtonClickedEvent
	| IPageViewEvent
	| IPageCreatedEvent
	| IUserUpgradedEvent
	| IUserSignedInEvent
	| IUserClickDownloadAppEvent
	| IMenuItemClickedEvent;

export default JitsuAnalyticsEvents;

export enum JitsuAnalyticsEventsEnum {
	USER_CREATED = 'User Created',
	BUTTON_CLICKED = 'Button_Clicked',
	PAGE_VIEW = 'Page_View',
	PAGE_CREATED = 'Page Created',
}

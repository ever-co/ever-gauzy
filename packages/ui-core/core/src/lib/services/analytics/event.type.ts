interface IUserCreatedEvent {
	eventType: JitsuAnalyticsEventsEnum.USER_CREATED;
	userId: string;
	email: string;
}

interface IButtonClickedEvent {
	eventType: JitsuAnalyticsEventsEnum.BUTTON_CLICKED;
	url: string;
	userId: string;
	userEmail: string;
}

interface IMenuItemClickedEvent extends IButtonClickedEvent {
	menuItemName: string;
}

interface IPageViewEvent {
	eventType: JitsuAnalyticsEventsEnum.PAGE_VIEW;
	url: string;
	periodicity: string;
}

interface IPageCreatedEvent {
	eventType: JitsuAnalyticsEventsEnum.PAGE_CREATED;
	slug: string;
}

interface IUserUpgradedEvent {
	eventType: JitsuAnalyticsEventsEnum.USER_UPGRADED;
	email: string;
}

interface IUserClickDownloadAppEvent {
	eventType: JitsuAnalyticsEventsEnum.USER_CLICK_DOWNLOAD_APP;
	email: string;
}

interface IUserSignedInEvent {
	eventType: JitsuAnalyticsEventsEnum.USER_SIGNED_IN;
	email: string;
}

export type JitsuAnalyticsEvents =
	| IUserCreatedEvent
	| IButtonClickedEvent
	| IPageViewEvent
	| IPageCreatedEvent
	| IUserUpgradedEvent
	| IUserSignedInEvent
	| IUserClickDownloadAppEvent
	| IMenuItemClickedEvent;

export enum JitsuAnalyticsEventsEnum {
	USER_CREATED = 'UserCreated',
	USER_SIGNED_IN = 'UserSignedIn',
	USER_CLICK_DOWNLOAD_APP = 'UserClickDownloadApp',
	USER_UPGRADED = 'UserUpgraded',
	BUTTON_CLICKED = 'ButtonClicked',
	PAGE_VIEW = 'PageView',
	PAGE_CREATED = 'PageCreated'
}

export interface ISelectorVisibility {
	readonly organization: boolean;
	readonly date: boolean;
	readonly project: boolean;
	readonly employee: boolean;
}

export const DEFAULT_SELECTOR_VISIBILITY: ISelectorVisibility = {
	organization: true,
	date: true,
	employee: true,
	project: true
};

import {IDesktopEnvironment} from "./i-desktop-environment";

export interface IContentGenerator {
	generate(variable: Partial<IDesktopEnvironment>): string;
}

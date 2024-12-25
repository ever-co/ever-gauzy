export interface IDirectoryPathGenerator {
	getBaseDirectory(name: string): string;
	getSubDirectory(): string;
}

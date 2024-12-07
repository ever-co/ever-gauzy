export interface IReadWriteFile {
	get hasDirectoryAccess(): boolean;
	write(fileContent: string): void;
	read(): string;
}

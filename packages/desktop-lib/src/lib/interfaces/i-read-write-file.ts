export interface IReadWriteFile {
	get hasDirectoryAccess(): boolean;
	write(fileContent: string): void;
	/** The file's content, or `undefined` when its directory is not writable or the file cannot be read. */
	read(): string | undefined;
}

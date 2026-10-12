import { dirname, join } from 'node:path';

/** A file of the SDK's contracts package (its schemas and fixtures), for specs. */
export function contractsFile(...parts: string[]): string {
	return join(dirname(require.resolve('@ever-co/connect-contracts/package.json')), ...parts);
}

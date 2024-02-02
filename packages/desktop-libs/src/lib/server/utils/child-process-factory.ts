import { ForkOptions, fork } from 'child_process';

export class ChildProcessFactory {
	public static createProcess(path, env, signal, options?: ForkOptions) {
		return fork(path, {
			silent: true,
			signal,
			env: {
				...process.env,
				...env
			},
			...options
		});
	}
}

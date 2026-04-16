/**
 * Contract for every deep-link protocol handler.
 *
 * Design principles applied:
 *  - Interface Segregation (SOLID-I): this interface is intentionally narrow so
 *    that implementors are not forced to depend on methods they do not use.
 *  - Open/Closed    (SOLID-O): new actions are supported by adding a new
 *    implementation, not by modifying this contract or the router.
 *  - Dependency Inversion (SOLID-D): the ProtocolRouter depends on this
 *    abstraction, never on concrete handler classes.
 */
export interface IProtocolHandler {
	/**
	 * The deep-link action this handler is responsible for.
	 * e.g. `"install-plugin"` for `gauzy://install-plugin?...`
	 */
	readonly action: string;

	/**
	 * Guards the handler: returns `true` when `action` matches the
	 * incoming request so the router can delegate without a type cast.
	 *
	 * @param action The action segment extracted from the deep-link URL.
	 */
	canHandle(action: string): boolean;

	/**
	 * Processes the validated deep-link URL.
	 *
	 * @param url The fully-parsed `URL` object of the incoming deep link.
	 * @throws When the action cannot be completed (e.g. missing parameters,
	 *         target window destroyed).  The router will queue the raw URL
	 *         as pending and retry on the next `processPending()` call.
	 */
	handle(url: URL): Promise<void>;
}

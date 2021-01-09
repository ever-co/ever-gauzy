export enum LogLevel {
	EMERGENCY = 0, //The application is in an emergency state.
	ALERT = 1, // The application owners need to be alerted.
	CRITICAL = 2, // The application is in a critical state.
	ERROR = 3, // A serious problem occurred while processing the current operation. Such a message usually requires the user to interact with the application or research the problem in order to find the cause and resolve it.
	WARNING = 4, // Such messages are reported when something unusual happened that isn’t critical to process the current operation (and the application in general), but would be useful to review to decide if it should be resolved.
	NOTICE = 5, // Notice messages are usually used for developers to notice application state.
	INFO = 6, // Informative messages are usually used for reporting significant application progress and stages. Informative messages should not be reported too frequently because they can quickly become “noise.”
	DEBUG = 7 // Used for debugging messages with extended information about application processing. Such messages usually report calls of important functions along with results they return and values of specific variables, or parameters.
}

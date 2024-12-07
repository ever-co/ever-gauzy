import { LanguagesEnum } from "@gauzy/contracts";

/**
 * Represents a serialized version of a request context.
 */
export type SerializedRequestContext = {
    _req?: any;               // Serialized request object
    _languageCode?: LanguagesEnum;  // Serialized language code
    _isAuthorized?: boolean;  // Serialized authorization status
};

/**
 * Formats a date to ISO string or returns null if the date is invalid
 */
export function formatDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toISOString();
  } catch (error) {
    console.error("Invalid date format:", error);
    return null;
  }
}

/**
 * Safely parses JSON or returns a default value
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    return defaultValue;
  }
}

/**
 * Creates a pagination object for API requests
 */
export function createPagination(page: number = 1, limit: number = 10) {
  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
}

/**
 * Handles API errors and returns a standardized error object
 */
export function handleApiError(error: any): { message: string; status: number } {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    return {
      message: error.response.data.message || "API error",
      status: error.response.status
    };
  } else if (error.request) {
    // The request was made but no response was received
    return {
      message: "No response from server",
      status: 0
    };
  } else {
    // Something happened in setting up the request that triggered an Error
    return {
      message: error.message || "Unknown error",
      status: 500
    };
  }
}
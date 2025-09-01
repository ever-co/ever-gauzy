export const API_PREFIX = '/api';
export const DEFAULT_SVG = 'assets/images/default.svg';
export const AVATAR_DEFAULT_SVG = 'assets/images/avatars/avatar-default.svg';
export const DUMMY_PROFILE_IMAGE = 'https://dummyimage.com/330x300/8b72ff/ffffff.jpg&text';

// Interval in milliseconds for partial timer polling (every 20 minutes).
// This can be increased or decreased if needed.
// Polling can overload the server, so sockets were introduced to make the process more efficient.
export const BACKGROUND_SYNC_INTERVAL = 1200000; // milliseconds

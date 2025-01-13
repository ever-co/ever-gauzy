/**
 * Returns a random element from an array.
 *
 * @param array - The array to select an element from.
 * @returns A random element from the array, or `null` if the array is empty.
 */
export function getRandomElement<T>(array: T[]): T | null {
    if (!Array.isArray(array) || array.length === 0) {
        return null; // Return null if the array is empty or not valid
    }

    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
}

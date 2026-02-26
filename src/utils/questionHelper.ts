const OPTIONAL_MARKER = '(*?)';

/**
 * Checks if the question is marked as optional.
 * A question is optional when it starts with the marker `(*?)`.
 * @param {string} question - The raw question text
 * @returns {boolean} true if the question is optional
 */
export const isOptionalQuestion = (question: string): boolean => {
    return question.startsWith(OPTIONAL_MARKER);
};

/**
 * Strips the optional marker `(*?)` from the beginning of a question.
 * If the marker is not at the beginning, the question is returned as-is.
 * @param {string} question - The raw question text
 * @returns {string} The question text without the leading optional marker
 */
export const stripOptionalMarker = (question: string): string => {
    if (!question.startsWith(OPTIONAL_MARKER)) return question;
    return question.slice(OPTIONAL_MARKER.length).trimStart();
};

// Utility functions for text formatting

/**
 * Capitalizes the first letter of each word in a string
 * @param {string} str - The string to capitalize
 * @returns {string} - The capitalized string
 */
export const capitalizeWords = (str) => {
  if (!str || typeof str !== 'string') return str;
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Capitalizes only the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} - The string with first letter capitalized
 */
export const capitalizeFirst = (str) => {
  if (!str || typeof str !== 'string') return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Auto-capitalization handler for form inputs
 * @param {Event} e - The input event
 * @param {Function} onChange - The original onChange handler
 * @param {string} type - The capitalization type ('words' or 'first')
 */
export const handleAutoCapitalize = (e, onChange, type = 'words') => {
  const value = e.target.value;
  const capitalizedValue = type === 'words' ? capitalizeWords(value) : capitalizeFirst(value);
  
  // Create a new event with the capitalized value
  const newEvent = {
    ...e,
    target: {
      ...e.target,
      value: capitalizedValue
    }
  };
  
  onChange(newEvent);
};

/**
 * Truncates a number to specified decimal places without rounding
 * @param {number} num - The number to truncate
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} - The truncated number formatted to specified decimals
 */
export const truncateToFixed = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) {
    return '0.00';
  }
  const multiplier = Math.pow(10, decimals);
  const truncated = Math.trunc(num * multiplier) / multiplier;
  return truncated.toFixed(decimals);
};
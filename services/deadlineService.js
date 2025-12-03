/**
 * Deadline Service
 * Utility functions for deadline validation and checking
 * 
 * @module services/deadlineService
 */

/**
 * Check if an assignment's deadline has passed
 * @param {Date|string} deadline - The assignment deadline
 * @returns {boolean} - True if deadline has passed, false otherwise
 */
export const isDeadlinePassed = (deadline) => {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  return deadlineDate < now;
};

/**
 * Check deadline and return detailed status
 * @param {Date|string} deadline - The assignment deadline
 * @returns {Object} - Deadline status object
 */
export const checkDeadline = (deadline) => {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const isPastDeadline = deadlineDate < now;
  
  // Calculate days until deadline (can be negative if past)
  const msUntil = deadlineDate - now;
  const daysUntil = Math.ceil(msUntil / (1000 * 60 * 60 * 24));
  const hoursUntil = Math.ceil(msUntil / (1000 * 60 * 60));
  
  // Check if deadline is urgent (within 24 hours)
  const isUrgent = !isPastDeadline && daysUntil <= 1;
  
  return {
    deadline: deadlineDate,
    isPastDeadline,
    daysUntil,
    hoursUntil,
    isUrgent,
    canSubmit: !isPastDeadline,
    message: isPastDeadline 
      ? 'Deadline has passed. You can no longer submit or resubmit this assignment.'
      : isUrgent 
        ? `Urgent: Only ${hoursUntil} hour${hoursUntil !== 1 ? 's' : ''} left!`
        : `${daysUntil} day${daysUntil !== 1 ? 's' : ''} remaining`
  };
};

/**
 * Validate submission against deadline
 * @param {Object} assignment - Assignment object with deadline property
 * @returns {Object} - Validation result { valid: boolean, message: string }
 */
export const validateSubmissionDeadline = (assignment) => {
  if (!assignment || !assignment.deadline) {
    return {
      valid: false,
      message: 'Assignment not found or deadline not set.'
    };
  }
  
  const status = checkDeadline(assignment.deadline);
  
  return {
    valid: status.canSubmit,
    message: status.message
  };
};

/**
 * Get formatted deadline string
 * @param {Date|string} deadline - The assignment deadline
 * @param {string} locale - Locale string (default: 'en-US')
 * @returns {string} - Formatted deadline string
 */
export const formatDeadline = (deadline, locale = 'en-US') => {
  const deadlineDate = new Date(deadline);
  
  const dateStr = deadlineDate.toLocaleDateString(locale, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  const timeStr = deadlineDate.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `${dateStr} at ${timeStr}`;
};

export default {
  isDeadlinePassed,
  checkDeadline,
  validateSubmissionDeadline,
  formatDeadline
};

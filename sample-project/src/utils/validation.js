/**
 * Validation Utilities
 * 
 * Input validation and sanitization functions.
 * Contains examples of various validation patterns.
 */

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {Object} Validation result
 */
function validateEmail(email) {
  const result = {
    isValid: false,
    errors: []
  };
  
  if (!email) {
    result.errors.push('Email is required');
    return result;
  }
  
  if (typeof email !== 'string') {
    result.errors.push('Email must be a string');
    return result;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    result.errors.push('Invalid email format');
    return result;
  }
  
  if (email.length > 254) {
    result.errors.push('Email too long (max 254 characters)');
    return result;
  }
  
  result.isValid = true;
  return result;
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with strength score
 */
function validatePassword(password) {
  const result = {
    isValid: false,
    strength: 0,
    errors: [],
    suggestions: []
  };
  
  if (!password) {
    result.errors.push('Password is required');
    return result;
  }
  
  if (typeof password !== 'string') {
    result.errors.push('Password must be a string');
    return result;
  }
  
  // Length check
  if (password.length < 8) {
    result.errors.push('Password must be at least 8 characters long');
  } else {
    result.strength += 1;
  }
  
  // Uppercase check
  if (!/[A-Z]/.test(password)) {
    result.suggestions.push('Add uppercase letters');
  } else {
    result.strength += 1;
  }
  
  // Lowercase check
  if (!/[a-z]/.test(password)) {
    result.suggestions.push('Add lowercase letters');
  } else {
    result.strength += 1;
  }
  
  // Number check
  if (!/\d/.test(password)) {
    result.suggestions.push('Add numbers');
  } else {
    result.strength += 1;
  }
  
  // Special character check
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    result.suggestions.push('Add special characters');
  } else {
    result.strength += 1;
  }
  
  // Common password check
  const commonPasswords = [
    'password', '123456', 'password123', 'admin', 'qwerty',
    'letmein', 'welcome', 'monkey', '1234567890'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    result.errors.push('Password is too common');
    result.strength = Math.max(0, result.strength - 2);
  }
  
  // Length bonus
  if (password.length >= 12) {
    result.strength += 1;
  }
  
  result.isValid = result.errors.length === 0 && result.strength >= 3;
  return result;
}

/**
 * Sanitize HTML input to prevent XSS
 * @param {string} input - HTML input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeHtml(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Basic HTML sanitization (in production, use a proper library like DOMPurify)
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize input to prevent injection attacks
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>\"'%;&\(\)]/g, '') // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length
}

/**
 * Validate and sanitize user input
 * @param {Object} data - Input data object
 * @param {Object} schema - Validation schema
 * @returns {Object} Validation result
 */
function validateRequest(data, schema) {
  const result = {
    isValid: true,
    errors: {},
    sanitizedData: {}
  };
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    const fieldErrors = [];
    
    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      fieldErrors.push(`${field} is required`);
      result.isValid = false;
      continue;
    }
    
    // Skip validation if field is not required and not provided
    if (!rules.required && (value === undefined || value === null)) {
      continue;
    }
    
    // Type validation
    if (rules.type && typeof value !== rules.type) {
      fieldErrors.push(`${field} must be of type ${rules.type}`);
      result.isValid = false;
    }
    
    // String validations
    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        fieldErrors.push(`${field} must be at least ${rules.minLength} characters`);
        result.isValid = false;
      }
      
      if (rules.maxLength && value.length > rules.maxLength) {
        fieldErrors.push(`${field} must be at most ${rules.maxLength} characters`);
        result.isValid = false;
      }
      
      if (rules.pattern && !rules.pattern.test(value)) {
        fieldErrors.push(`${field} format is invalid`);
        result.isValid = false;
      }
      
      // Sanitize string
      result.sanitizedData[field] = rules.sanitize ? sanitizeHtml(value) : value;
    }
    
    // Number validations
    if (rules.type === 'number' && typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        fieldErrors.push(`${field} must be at least ${rules.min}`);
        result.isValid = false;
      }
      
      if (rules.max !== undefined && value > rules.max) {
        fieldErrors.push(`${field} must be at most ${rules.max}`);
        result.isValid = false;
      }
      
      result.sanitizedData[field] = value;
    }
    
    // Array validations
    if (rules.type === 'array' && Array.isArray(value)) {
      if (rules.minItems && value.length < rules.minItems) {
        fieldErrors.push(`${field} must have at least ${rules.minItems} items`);
        result.isValid = false;
      }
      
      if (rules.maxItems && value.length > rules.maxItems) {
        fieldErrors.push(`${field} must have at most ${rules.maxItems} items`);
        result.isValid = false;
      }
      
      result.sanitizedData[field] = value;
    }
    
    // Custom validation function
    if (rules.validate && typeof rules.validate === 'function') {
      const customResult = rules.validate(value);
      if (!customResult.isValid) {
        fieldErrors.push(...customResult.errors);
        result.isValid = false;
      }
    }
    
    if (fieldErrors.length > 0) {
      result.errors[field] = fieldErrors;
    }
  }
  
  return result;
}

/**
 * Express middleware for request validation
 * @param {Object} schema - Validation schema
 * @returns {Function} Express middleware
 */
function validateRequestMiddleware(schema) {
  return (req, res, next) => {
    const validation = validateRequest(req.body, schema);
    
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }
    
    // Replace req.body with sanitized data
    req.body = validation.sanitizedData;
    next();
  };
}

/**
 * Complex validation function for user registration
 * (High complexity for analysis demonstration)
 */
function validateUserRegistration(userData) {
  const result = {
    isValid: true,
    errors: {},
    warnings: []
  };
  
  // Email validation
  const emailValidation = validateEmail(userData.email);
  if (!emailValidation.isValid) {
    result.errors.email = emailValidation.errors;
    result.isValid = false;
  }
  
  // Password validation
  const passwordValidation = validatePassword(userData.password);
  if (!passwordValidation.isValid) {
    result.errors.password = passwordValidation.errors;
    result.isValid = false;
  } else if (passwordValidation.strength < 4) {
    result.warnings.push('Consider using a stronger password');
  }
  
  // Name validation
  if (!userData.name || userData.name.trim().length < 2) {
    result.errors.name = ['Name must be at least 2 characters long'];
    result.isValid = false;
  } else if (userData.name.length > 100) {
    result.errors.name = ['Name must be at most 100 characters long'];
    result.isValid = false;
  }
  
  // Age validation (if provided)
  if (userData.age !== undefined) {
    if (typeof userData.age !== 'number' || userData.age < 13 || userData.age > 120) {
      result.errors.age = ['Age must be between 13 and 120'];
      result.isValid = false;
    }
  }
  
  // Terms acceptance
  if (!userData.acceptTerms) {
    result.errors.terms = ['You must accept the terms and conditions'];
    result.isValid = false;
  }
  
  // Nested validation for additional fields
  if (userData.profile) {
    if (userData.profile.bio && userData.profile.bio.length > 500) {
      result.errors['profile.bio'] = ['Bio must be at most 500 characters'];
      result.isValid = false;
    }
    
    if (userData.profile.website) {
      const urlRegex = /^https?:\/\/.+/;
      if (!urlRegex.test(userData.profile.website)) {
        result.errors['profile.website'] = ['Website must be a valid URL'];
        result.isValid = false;
      }
    }
  }
  
  return result;
}

module.exports = {
  validateEmail,
  validatePassword,
  sanitizeHtml,
  sanitizeInput,
  validateRequest,
  validateRequestMiddleware,
  validateUserRegistration
};

/**
 * Input Sanitization Utilities
 * Prevents XSS attacks and ensures data integrity
 */

/**
 * Sanitize HTML content by escaping special characters
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';
  
  return input
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize email addresses
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  
  // Remove whitespace and convert to lowercase
  const cleaned = email.trim().toLowerCase();
  
  // Basic email validation pattern
  const emailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  
  if (!emailPattern.test(cleaned)) {
    throw new Error('Invalid email format');
  }
  
  return cleaned;
}

/**
 * Sanitize phone numbers (remove non-numeric characters except +)
 */
export function sanitizePhone(phone: string): string {
  if (!phone) return '';
  
  // Keep only digits, spaces, hyphens, parentheses, and leading +
  return phone.replace(/[^\d\s\-()+ ]/g, '').trim();
}

/**
 * Sanitize text input (general purpose)
 */
export function sanitizeText(input: string, maxLength: number = 1000): string {
  if (!input) return '';
  
  // Trim whitespace
  let sanitized = input.trim();
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(input: string | number, options?: {
  min?: number;
  max?: number;
  allowDecimals?: boolean;
}): number {
  const { min, max, allowDecimals = true } = options || {};
  
  // Convert to number
  let num = typeof input === 'string' ? parseFloat(input) : input;
  
  // Check if valid number
  if (isNaN(num) || !isFinite(num)) {
    throw new Error('Invalid number');
  }
  
  // Round if decimals not allowed
  if (!allowDecimals) {
    num = Math.round(num);
  }
  
  // Apply min/max constraints
  if (min !== undefined && num < min) {
    num = min;
  }
  if (max !== undefined && num > max) {
    num = max;
  }
  
  return num;
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  
  const cleaned = url.trim();
  
  // Only allow http, https, and mailto protocols
  const allowedProtocols = ['http:', 'https:', 'mailto:'];
  
  try {
    const urlObj = new URL(cleaned);
    
    if (!allowedProtocols.includes(urlObj.protocol)) {
      throw new Error('Invalid URL protocol');
    }
    
    return urlObj.toString();
  } catch {
    // If URL parsing fails, check if it's a relative URL
    if (cleaned.startsWith('/')) {
      return cleaned;
    }
    
    throw new Error('Invalid URL format');
  }
}

/**
 * Sanitize file name
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName) return '';
  
  // Remove path traversal attempts
  let sanitized = fileName.replace(/\.\./g, '');
  
  // Remove special characters except dots, hyphens, and underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop();
    const name = sanitized.substring(0, 250 - (ext?.length || 0));
    sanitized = ext ? `${name}.${ext}` : name;
  }
  
  return sanitized;
}

/**
 * Sanitize SQL-like input (for search queries)
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query) return '';
  
  let sanitized = query.trim();
  
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi,
    /[;'"\\]/g,
    /--/g,
    /\/\*/g,
    /\*\//g,
  ];
  
  // Iteratively remove SQL patterns until no more matches are found
  // This handles nested attempts like "SESELECTLECT" → "SELECT" → ""
  let previous;
  do {
    previous = sanitized;
    sqlPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });
    sanitized = sanitized.trim();
  } while (sanitized !== previous);
  
  return sanitized.substring(0, 200);
}

/**
 * Sanitize JSON input
 */
export function sanitizeJson<T = any>(input: string, maxDepth: number = 10): T {
  if (!input) throw new Error('Empty JSON input');
  
  try {
    const parsed = JSON.parse(input);
    
    // Check depth to prevent deeply nested objects
    const checkDepth = (obj: any, depth: number = 0): void => {
      if (depth > maxDepth) {
        throw new Error('JSON object too deeply nested');
      }
      
      if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(value => {
          checkDepth(value, depth + 1);
        });
      }
    };
    
    checkDepth(parsed);
    
    return parsed as T;
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sanitize object properties recursively
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  options?: {
    allowedKeys?: string[];
    maxStringLength?: number;
  }
): T {
  const { allowedKeys, maxStringLength = 1000 } = options || {};
  
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip if key not in allowed list
    if (allowedKeys && !allowedKeys.includes(key)) {
      continue;
    }
    
    // Sanitize based on type
    if (typeof value === 'string') {
      sanitized[key] = sanitizeText(value, maxStringLength);
    } else if (typeof value === 'number') {
      sanitized[key] = value;
    } else if (typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (value === null) {
      sanitized[key] = null;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'object' && item !== null
          ? sanitizeObject(item, options)
          : typeof item === 'string'
          ? sanitizeText(item, maxStringLength)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, options);
    }
  }
  
  return sanitized as T;
}

/**
 * Validate and sanitize UUID
 */
export function sanitizeUuid(uuid: string): string {
  if (!uuid) throw new Error('UUID is required');
  
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  const cleaned = uuid.trim().toLowerCase();
  
  if (!uuidPattern.test(cleaned)) {
    throw new Error('Invalid UUID format');
  }
  
  return cleaned;
}

/**
 * Sanitize date input
 */
export function sanitizeDate(date: string | Date): Date {
  if (!date) throw new Error('Date is required');
  
  const parsed = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(parsed.getTime())) {
    throw new Error('Invalid date format');
  }
  
  return parsed;
}

/**
 * Rate limiting helper - track attempts
 */
const attemptTracker = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = attemptTracker.get(key);
  
  // Clean up expired records
  if (record && now > record.resetAt) {
    attemptTracker.delete(key);
  }
  
  const current = attemptTracker.get(key);
  
  if (!current) {
    // First attempt
    attemptTracker.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, resetAt: now + windowMs };
  }
  
  if (current.count >= maxAttempts) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }
  
  // Increment count
  current.count++;
  return { allowed: true, remaining: maxAttempts - current.count, resetAt: current.resetAt };
}

// Made with Bob

/**
 * User Service Module
 * 
 * Handles user-related database operations and business logic.
 * Contains examples of various code patterns for AI analysis.
 */

const bcrypt = require('bcryptjs');
const _ = require('lodash');

// Simulated database (in real app, this would be a proper database)
let users = [
  {
    id: 1,
    email: 'admin@example.com',
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JdP6LhCa6', // 'password123'
    type: 'premium',
    subscription: {
      active: true,
      plan: 'enterprise'
    },
    permissions: ['admin']
  },
  {
    id: 2,
    email: 'user@example.com',
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj2JdP6LhCa6',
    type: 'free',
    permissions: ['read']
  }
];

/**
 * Find user by ID
 * @param {number} id - User ID
 * @returns {Object|null} User object or null if not found
 */
async function findById(id) {
  // Simulate async database operation
  await sleep(50);
  
  const user = users.find(u => u.id === parseInt(id));
  return user ? { ...user } : null;
}

/**
 * Find user by email
 * @param {string} email - User email
 * @returns {Object|null} User object or null if not found
 */
async function findByEmail(email) {
  await sleep(50);
  
  if (!email || typeof email !== 'string') {
    throw new Error('Invalid email parameter');
  }
  
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  return user ? { ...user } : null;
}

/**
 * Create a new user
 * @param {Object} userData - User data
 * @returns {Object} Created user
 */
async function createUser(userData) {
  await sleep(100);
  
  // Validation
  if (!userData.email || !userData.password) {
    throw new Error('Email and password are required');
  }
  
  // Check if user already exists
  const existingUser = await findByEmail(userData.email);
  if (existingUser) {
    throw new Error('User already exists');
  }
  
  // Hash password
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(userData.password, saltRounds);
  
  // Create user object
  const newUser = {
    id: users.length + 1,
    email: userData.email,
    passwordHash,
    type: userData.type || 'free',
    permissions: userData.permissions || ['read'],
    createdAt: new Date().toISOString(),
    subscription: userData.subscription || null
  };
  
  users.push(newUser);
  
  return _.omit(newUser, ['passwordHash']);
}

/**
 * Update user data
 * @param {number} id - User ID
 * @param {Object} updateData - Data to update
 * @returns {Object} Updated user
 */
async function updateUser(id, updateData) {
  await sleep(75);
  
  const userIndex = users.findIndex(u => u.id === parseInt(id));
  if (userIndex === -1) {
    throw new Error('User not found');
  }
  
  // Don't allow updating sensitive fields directly
  const allowedFields = ['email', 'type', 'permissions', 'subscription'];
  const filteredData = _.pick(updateData, allowedFields);
  
  // Update user
  users[userIndex] = {
    ...users[userIndex],
    ...filteredData,
    updatedAt: new Date().toISOString()
  };
  
  return _.omit(users[userIndex], ['passwordHash']);
}

/**
 * Delete user
 * @param {number} id - User ID
 * @returns {boolean} Success status
 */
async function deleteUser(id) {
  await sleep(50);
  
  const userIndex = users.findIndex(u => u.id === parseInt(id));
  if (userIndex === -1) {
    return false;
  }
  
  users.splice(userIndex, 1);
  return true;
}

/**
 * Get all users with pagination
 * @param {Object} options - Pagination options
 * @returns {Object} Paginated users
 */
async function getAllUsers(options = {}) {
  await sleep(100);
  
  const { page = 1, limit = 10, search = '' } = options;
  const offset = (page - 1) * limit;
  
  let filteredUsers = users;
  
  // Apply search filter
  if (search) {
    filteredUsers = users.filter(user => 
      user.email.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  // Apply pagination
  const paginatedUsers = filteredUsers
    .slice(offset, offset + limit)
    .map(user => _.omit(user, ['passwordHash']));
  
  return {
    users: paginatedUsers,
    total: filteredUsers.length,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(filteredUsers.length / limit)
  };
}

/**
 * Update user password
 * @param {number} id - User ID
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @returns {boolean} Success status
 */
async function updatePassword(id, oldPassword, newPassword) {
  await sleep(150); // Password operations are typically slower
  
  const user = await findById(id);
  if (!user) {
    throw new Error('User not found');
  }
  
  // Verify old password
  const isValidPassword = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!isValidPassword) {
    throw new Error('Invalid current password');
  }
  
  // Validate new password (basic validation)
  if (!newPassword || newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long');
  }
  
  // Hash new password
  const saltRounds = 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
  
  // Update password
  const userIndex = users.findIndex(u => u.id === parseInt(id));
  users[userIndex].passwordHash = newPasswordHash;
  users[userIndex].passwordUpdatedAt = new Date().toISOString();
  
  return true;
}

/**
 * Complex user analytics function (high complexity for analysis)
 * @param {Object} filters - Analytics filters
 * @returns {Object} User analytics
 */
async function getUserAnalytics(filters = {}) {
  await sleep(200);
  
  const analytics = {
    totalUsers: users.length,
    usersByType: {},
    usersByPermissions: {},
    subscriptionStats: {},
    activityStats: {}
  };
  
  // Complex nested logic for demonstration
  for (const user of users) {
    // Count by type
    if (user.type) {
      analytics.usersByType[user.type] = (analytics.usersByType[user.type] || 0) + 1;
    }
    
    // Count by permissions
    if (user.permissions && Array.isArray(user.permissions)) {
      for (const permission of user.permissions) {
        analytics.usersByPermissions[permission] = (analytics.usersByPermissions[permission] || 0) + 1;
      }
    }
    
    // Subscription analytics
    if (user.subscription) {
      if (user.subscription.active) {
        const plan = user.subscription.plan || 'unknown';
        analytics.subscriptionStats[plan] = (analytics.subscriptionStats[plan] || 0) + 1;
      }
    }
  }
  
  // Apply filters (complex conditional logic)
  if (filters.dateRange) {
    if (filters.dateRange.start && filters.dateRange.end) {
      // This would filter by date in a real implementation
      analytics.filtered = true;
    }
  }
  
  if (filters.userType) {
    if (analytics.usersByType[filters.userType]) {
      analytics.filteredCount = analytics.usersByType[filters.userType];
    }
  }
  
  if (filters.includeDetailed) {
    analytics.detailed = users.map(user => ({
      id: user.id,
      type: user.type,
      permissionCount: user.permissions ? user.permissions.length : 0,
      hasSubscription: !!user.subscription
    }));
  }
  
  return analytics;
}

/**
 * Utility function to simulate async operations
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export all functions
module.exports = {
  findById,
  findByEmail,
  createUser,
  updateUser,
  deleteUser,
  getAllUsers,
  updatePassword,
  getUserAnalytics
};

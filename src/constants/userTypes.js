export const USER_TYPES = {
  BASIC: 'basic', // Default free user
  SELF_ADVOCATE_PLUS: 'self-advocate-plus',
  SELF_ADVOCATE_DATING: 'self-advocate-dating',
  SUPPORTER_1: 'supporter-1',
  SUPPORTER_5: 'supporter-5',
  SUPPORTER_10: 'supporter-10'
};

export const STRIPE_PRODUCTS = {
  SELF_ADVOCATE_PLUS: 'price_1QcoKMKsSm8QZ3xYMdZytQWI', // Replace with your Stripe price ID
  SELF_ADVOCATE_DATING: 'price_1QcsdUKsSm8QZ3xY5eSumBGO',
  SUPPORTER_1: 'price_1QZDoHKsSm8QZ3xYSkYVFVKW',
  SUPPORTER_5: 'price_1QcsYoKsSm8QZ3xY16MyY6zn',
  SUPPORTER_10: 'price_1Qcsa4KsSm8QZ3xYfQPyK6AA'
};

export const USER_TYPE_LIMITS = {
  [USER_TYPES.SUPPORTER_1]: 1,
  [USER_TYPES.SUPPORTER_5]: 5,
  [USER_TYPES.SUPPORTER_10]: 10
};

export const USER_TYPE_FEATURES = {
  [USER_TYPES.BASIC]: {
    canChat: true,
    canHaveSupporters: false,
    canBeSupporter: false,
    canAccessDating: false,
    maxSupportedUsers: 0
  },
  [USER_TYPES.SELF_ADVOCATE_PLUS]: {
    canChat: true,
    canHaveSupporters: true,
    canBeSupporter: false,
    canAccessDating: false,
    maxSupportedUsers: 0
  },
  [USER_TYPES.SELF_ADVOCATE_DATING]: {
    canChat: true,
    canHaveSupporters: true,
    canBeSupporter: false,
    canAccessDating: true,
    maxSupportedUsers: 0
  },
  [USER_TYPES.SUPPORTER_1]: {
    canChat: true,
    canHaveSupporters: false,
    canBeSupporter: true,
    canAccessDating: false,
    maxSupportedUsers: 1
  },
  [USER_TYPES.SUPPORTER_5]: {
    canChat: true,
    canHaveSupporters: false,
    canBeSupporter: true,
    canAccessDating: false,
    maxSupportedUsers: 5
  },
  [USER_TYPES.SUPPORTER_10]: {
    canChat: true,
    canHaveSupporters: false,
    canBeSupporter: true,
    canAccessDating: false,
    maxSupportedUsers: 10
  }
}; 
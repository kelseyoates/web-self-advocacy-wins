export interface User {
  uid: string;
  email: string;
  username: string;
  userType: string;
  supporters: string[]; // UIDs of supporters
  supporting: string[]; // UIDs of users being supported
  profilePicture?: string;
  birthdate?: string;
  state?: string;
  following?: string[];
  followers?: string[];
  // ... other existing fields
} 
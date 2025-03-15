import { CometChat } from '@cometchat-pro/react-native-chat';
import { COMETCHAT_CONSTANTS } from '../config/cometChatConfig';

export const COMETCHAT_ROLES = {
  BASIC_USER: 'default',
  SELF_ADVOCATE: 'self-advocate',
  SUPPORTER: 'supporter',
  DATING_USER: 'dating-user'
};

const safeExecute = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    console.error('CometChat operation failed:', error);
    return null;
  }
};

export const ensureUserLoggedIn = async (userId) => {
  if (!userId) {
    console.error('No userId provided to ensureUserLoggedIn');
    return null;
  }

  try {
    const { isInitialized, currentUser } = await checkCometChatState();
    
    // If already logged in as correct user, return
    if (currentUser?.uid === userId) {
      console.log('User already logged in:', currentUser);
      return currentUser;
    }

    // If someone else is logged in or state is unclear, clean up
    if (currentUser || !isInitialized) {
      await cleanupCometChat();
    }

    // Re-initialize if needed
    if (!CometChat.isInitialized()) {
      const appSettings = new CometChat.AppSettingsBuilder()
        .subscribePresenceForAllUsers()
        .setRegion(COMETCHAT_CONSTANTS.REGION)
        .build();

      await CometChat.init(COMETCHAT_CONSTANTS.APP_ID, appSettings);
    }

    // Login
    console.log('Logging in user:', userId);
    const loggedInUser = await CometChat.login(userId, COMETCHAT_CONSTANTS.AUTH_KEY);
    console.log('Successfully logged in:', loggedInUser);
    return loggedInUser;
  } catch (error) {
    console.error('CometChat login error:', error);
    return null;
  }
};

export const getUserConversations = async () => {
  try {
    const currentUser = await CometChat.getLoggedInUser();
    if (!currentUser) {
      throw new Error('No user logged in');
    }

    const conversationsRequest = new CometChat.ConversationsRequestBuilder()
      .setLimit(50)
      .build();

    const conversations = await conversationsRequest.fetchNext();
    return conversations || [];
  } catch (error) {
    console.error('Error fetching conversations:', error);
    throw error;
  }
};

export const getSupportedUserConversations = async (supportedUserId) => {
  try {
    // Create a group ID for the supported user's conversations
    const groupId = `support_${supportedUserId}`;
    
    // Get messages from the support group
    const messagesRequest = new CometChat.MessagesRequestBuilder()
      .setGUID(groupId)
      .setLimit(50)
      .build();

    const messages = await messagesRequest.fetchPrevious();
    return messages || [];
  } catch (error) {
    console.error('Error fetching supported user conversations:', error);
    throw error;
  }
};

export const setupSupporterAccess = async (supporterUid, userUid) => {
  try {
    // Create a support group for the user if it doesn't exist
    const groupId = `support_${userUid}`;
    const groupName = `Support Group for ${userUid}`;

    try {
      // Try to get existing group
      await CometChat.getGroup(groupId);
    } catch {
      // Group doesn't exist, create it
      const group = new CometChat.Group(
        groupId,
        groupName,
        CometChat.GROUP_TYPE.PRIVATE,
        ''
      );
      await CometChat.createGroup(group);
    }

    // Add supporter to group with read-only access
    await CometChat.addMembersToGroup(groupId, [
      new CometChat.GroupMember(supporterUid, CometChat.GROUP_MEMBER_SCOPE.PARTICIPANT)
    ], []);

    // Mirror the user's conversations to the support group
    // This would need to be set up as a webhook or function in your backend
    
    return true;
  } catch (error) {
    console.error('Error setting up supporter access:', error);
    throw error;
  }
};

export const createSupporterUser = async (uid, username) => {
  try {
    // First check if user exists
    try {
      const existingUser = await CometChat.getUser(uid);
      if (existingUser) {
        // Update existing user while preserving their chat access
        const userUpdate = new CometChat.User({
          uid: uid,
          role: COMETCHAT_ROLES.SUPPORTER
        });
        await CometChat.updateUser(userUpdate);
        return true;
      }
    } catch {
      // User doesn't exist, create new
      const user = new CometChat.User({
        uid: uid,
        name: username,
        role: COMETCHAT_ROLES.SUPPORTER
      });
      await CometChat.createUser(user, COMETCHAT_CONSTANTS.AUTH_KEY);
    }
    return true;
  } catch (error) {
    console.error('Error creating/updating supporter:', error);
    throw error;
  }
};

export const updateUserRole = async (uid, role) => {
  try {
    const user = await CometChat.getUser(uid);
    if (!user) {
      console.error('User not found in CometChat');
      return;
    }

    // Update user's role
    await CometChat.updateUser(
      new CometChat.User({
        uid: uid,
        role: role
      })
    );

    console.log('Successfully updated user role in CometChat:', role);
  } catch (error) {
    console.error('Error updating CometChat user role:', error);
    throw error;
  }
};

export const grantSupporterAccess = async (supporterUid, userUid) => {
  try {
    // Create a group specifically for supporter access
    const groupId = `support_${userUid}`;
    const groupName = `Support Group for ${userUid}`;
    
    // Check if group exists
    try {
      await CometChat.getGroup(groupId);
    } catch (error) {
      // Group doesn't exist, create it
      const group = new CometChat.Group(
        groupId,
        groupName,
        CometChat.GROUP_TYPE.PRIVATE,
        ''
      );
      await CometChat.createGroup(group);
    }

    // Add supporter to group with moderator scope
    await CometChat.addMembersToGroup(groupId, [
      new CometChat.GroupMember(supporterUid, CometChat.GROUP_MEMBER_SCOPE.MODERATOR)
    ], []);

    console.log('Successfully granted supporter access');
  } catch (error) {
    console.error('Error granting supporter access:', error);
    throw error;
  }
};

export const revokeSupporterAccess = async (supporterUid, userUid) => {
  try {
    const groupId = `support_${userUid}`;
    
    // Remove supporter from group
    await CometChat.banGroupMember(groupId, supporterUid);
    
    console.log('Successfully revoked supporter access');
  } catch (error) {
    console.error('Error revoking supporter access:', error);
    throw error;
  }
};

// Function to check if a user is a supporter for another user
export const isSupporterFor = async (supporterUid, userUid) => {
  try {
    const groupId = `support_${userUid}`;
    const member = await CometChat.getGroupMember(groupId, supporterUid);
    return member && member.scope === CometChat.GROUP_MEMBER_SCOPE.MODERATOR;
  } catch (error) {
    return false;
  }
};

// Function to get all chats accessible to a supporter
export const getSupporterChats = async (supporterUid) => {
  try {
    const groups = await CometChat.getJoinedGroups(
      new CometChat.GroupsRequestBuilder()
        .setLimit(100)
        .build()
    );

    return groups.filter(group => group.id.startsWith('support_'));
  } catch (error) {
    console.error('Error getting supporter chats:', error);
    return [];
  }
};

export const cleanupCometChat = async () => {
  try {
    // Safely remove all listeners
    CometChat.removeMessageListener('CHAT_SCREEN_MESSAGE_LISTENER');
    CometChat.removeMessageListener('MODERATION_LISTENER');
    
    // Any other listeners you might have...
    
    // Optionally logout
    const currentUser = await safeExecute(() => CometChat.getLoggedInUser());
    if (currentUser) {
      await safeExecute(() => CometChat.logout());
    }
    
    console.log('CometChat cleanup completed');
    return true;
  } catch (error) {
    console.error('Error during CometChat cleanup:', error);
    return false;
  }
};

export const checkCometChatState = async () => {
  try {
    const isInitialized = CometChat.isInitialized();
    const currentUser = await safeExecute(() => CometChat.getLoggedInUser());
    
    console.log('CometChat state:', {
      isInitialized,
      currentUser: currentUser?.uid
    });
    
    return {
      isInitialized,
      currentUser
    };
  } catch (error) {
    console.error('Error checking CometChat state:', error);
    return {
      isInitialized: false,
      currentUser: null
    };
  }
}; 
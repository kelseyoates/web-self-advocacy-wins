const functions = require("firebase-functions");
const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Typesense = require("typesense");


if (!admin.apps.length) {
  admin.initializeApp();
}

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const sig = req.headers["stripe-signature"];
    const rawBody = req.rawBody;

    if (!sig || !rawBody) {
      console.error("No signature or raw body found");
      return res.status(400).send("Missing signature or raw body");
    }

    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      console.error(`Webhook signature verification failed:`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log("Event constructed:", event.type);
    console.log("Event data:", event.data.object);

    const firestore = admin.firestore();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log("Full session data:", JSON.stringify(session, null, 2));

        if (session.promotion_code) {
          console.log("Promotion code used:", session.promotion_code);
        }
        if (session.total_details && session.total_details.breakdown) {
          console.log("Discount details:",
              session.total_details.breakdown.discounts);
        }
        if (session.discount) {
          console.log("Discount applied:", session.discount);
        }

        const userId = session.client_reference_id.toLowerCase();
        if (!userId) {
          console.error("No userId found in webhook data");
          return res.status(400).send("No userId found");
        }

        let subscriptionType = "unknown";
        switch (session.payment_link) {
          case "plink_1Qf6dRKsSm8QZ3xYyUmSeN60":
            subscriptionType = "selfAdvocatePlus";
            console.log("Matched Self Advocate Plus payment link");
            break;
          case "plink_1Qf6dKKsSm8QZ3xYZgKVuaKt":
            subscriptionType = "selfAdvocateDating";
            console.log("Matched Self Advocate Dating payment link");
            break;
          case "plink_1Qf6dMKsSm8QZ3xYBnyNxIjH":
            subscriptionType = "supporter1";
            console.log("Matched Supporter 1 payment link");
            break;
          case "plink_1Qf6iIKsSm8QZ3xYrAU4jqYR":
            subscriptionType = "supporter5";
            console.log("Matched Supporter 5 payment link");
            break;
          case "plink_1Qf6dBKsSm8QZ3xYTiufTvcC":
            subscriptionType = "supporter10";
            console.log("Matched Supporter 10 payment link");
            break;
          default:
            console.log("No payment link match found");
        }

        console.log("User ID:", userId);
        console.log("Subscription Type:", subscriptionType);
        console.log("Payment Link:", session.payment_link);

        const userDoc = await firestore.collection("users").doc(userId).get();
        if (!userDoc.exists) {
          await firestore.collection("users").doc(userId).set({
            subscriptionStatus: "active",
            subscriptionType,
            subscriptionId: session.subscription,
            customerId: session.customer,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log("Created new user document with subscription");
        } else {
          await firestore.collection("users").doc(userId).update({
            subscriptionStatus: "active",
            subscriptionType,
            subscriptionId: session.subscription,
            customerId: session.customer,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log("Updated existing user document");
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        console.log("Subscription update received:", subscription);

        const usersRef = firestore.collection("users");
        const snapshot = await usersRef
            .where("customerId", "==", subscription.customer)
            .get();

        if (!snapshot.empty) {
          const userId = snapshot.docs[0].id;
          let subscriptionType = "selfAdvocateFree";

          switch (subscription.items.data[0].price.id) {
            case "price_1Qf6dRKsSm8QZ3xYVzYg8BSU":
              subscriptionType = "selfAdvocatePlus";
              console.log("Updated to Self Advocate Plus");
              break;
            case "price_1Qf6dKKsSm8QZ3xYzqXIqAVc":
              subscriptionType = "selfAdvocateDating";
              console.log("Updated to Self Advocate Dating");
              break;
            case "price_1Qf6dMKsSm8QZ3xYNjFNaI36":
              subscriptionType = "supporter1";
              console.log("Updated to Supporter 1");
              break;
            case "price_1Qf6cJKsSm8QZ3xYTbJYOL3P":
              subscriptionType = "supporter5";
              console.log("Updated to Supporter 5");
              break;
            case "price_1Qf6dBKsSm8QZ3xYMxoOPvH2":
              subscriptionType = "supporter10";
              console.log("Updated to Supporter 10");
              break;
            default:
              console.log("No matching price ID found for update");
          }

          await firestore.collection("users").doc(userId).update({
            subscriptionStatus: subscription.status,
            subscriptionType,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`Updated user ${userId} to ${subscriptionType}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        console.log("Subscription deletion received:", subscription);

        const usersRef = firestore.collection("users");
        const snapshot = await usersRef
            .where("customerId", "==", subscription.customer)
            .get();

        if (!snapshot.empty) {
          const userId = snapshot.docs[0].id;
          await firestore.collection("users").doc(userId).update({
            subscriptionStatus: "canceled",
            subscriptionType: "selfAdvocateFree",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`Reset user ${userId} to free plan`);
        }
        break;
      }
    }

    return res.json({received: true});
  } catch (error) {
    console.error("Error processing webhook:", error);
    return res.status(500).send(`Webhook Error: ${error.message}`);
  }
});

// Initialize Typesense client with environment variables
const client = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST,
    port: "443",
    protocol: "https",
  }],
  apiKey: process.env.TYPESENSE_API_KEY,
  connectionTimeoutSeconds: 2,
});

/**
 * Creates a Typesense collection with the specified schema if it doesn't exist
 * @async
 * @return {Promise<void>}
 * A promise that resolves when the collection is created
 * @throws {Error}
 * If there's an error creating the collection (except 409 Conflict)
 */
async function createCollection() {
  const schema = {
    name: "users",
    fields: [
      {name: "username", type: "string"},
      {name: "state", type: "string"},
      {name: "subscriptionStatus", type: "string"},
      {name: "subscriptionType", type: "string"},
      {name: "age_str", type: "string", optional: true},
      {name: "age_sort", type: "float", optional: true, facet: true},
      {name: "id", type: "string"},
      {name: "profilePicture", type: "string", optional: true},
      {name: "winTopics", type: "string[]", optional: true},
      {name: "gender", type: "string", optional: true},
      {name: "lookingFor", type: "string", optional: true},
      {name: "questionAnswers", type: "object[]", optional: true},
      {name: "_searchableContent", type: "string", optional: true},
    ],
    enable_nested_fields: true,
  };

  try {
    // Delete if exists
    try {
      await client.collections("users").delete();
      console.log("Deleted existing collection");
    } catch (err) {
      console.log("Collection did not exist");
    }

    // Create new collection with updated schema
    await client.collections().create(schema);
    console.log("Created new collection with schema");
    return true;
  } catch (error) {
    console.error("Error in createCollection:", error);
    throw error;
  }
}

exports.onUserUpdateTypesense = onDocumentUpdated("users/{userId}",
    async (event) => {
      try {
        const userId = event.params.userId;

        // Directly fetch the current Firestore document
        const firestore = admin.firestore();
        const userDoc = await firestore.collection("users").doc(userId).get();
        const userData = userDoc.data();

        // Handle age values
        const ageNumber = parseInt(userData.age || 0, 10);
        const ageString = ageNumber.toString();

        console.log("Processing age:", {
          original: userData.age,
          asNumber: ageNumber,
          asString: ageString,
        });

        const typesenseObject = {
          id: userId,
          subscriptionStatus: userData.subscriptionStatus || "inactive",
          subscriptionType: userData.subscriptionType || "selfAdvocateFree",
          username: userData.username || "",
          profilePicture: userData.profilePicture || "",
          state: userData.state || "",
          age_str: ageString,
          age_sort: ageNumber,
          questionAnswers: userData.questionAnswers || [],
          _searchableContent: userData.questionAnswers ?
            userData.questionAnswers.map((qa) =>
              `${qa.textAnswer || ""} ${(qa.selectedWords || []).join(" ")}`,
            ).join(" ") : "",
          matchScore: 1.0,
        };

        try {
          await client.collections("users").documents().upsert(typesenseObject);
          console.log("Updated Typesense with age values:", {
            age_str: ageString,
            age_sort: ageNumber,
          });
        } catch (typesenseError) {
          console.error("Typesense update failed:", typesenseError);
          throw typesenseError;
        }

        return null;
      } catch (error) {
        console.error("Error in onUserUpdateTypesense:", error);
        throw error;
      }
    });

/**
 * Creates a searchable content string from user data
 * Combines question answers and winTopics into a single searchable string
 * @param {Object} userData - The user data object from Firestore
 * @param {Array} [userData.questionAnswers] - Array of question answers
 * @param {Array} [userData.winTopics] - Array of win topics
 * @return {string} Combined searchable content string
 */
function createSearchableContent(userData) {
  let searchableContent = "";

  // Add question answers to searchable content
  if (userData.questionAnswers) {
    userData.questionAnswers.forEach((qa) => {
      if (qa.textAnswer) searchableContent += qa.textAnswer + " ";
      if (qa.selectedWords) {
        searchableContent += qa.selectedWords.join(" ") + " ";
      }
    });
  }

  // Add winTopics to searchable content
  if (userData.winTopics) {
    searchableContent += userData.winTopics.join(" ") + " ";
  }

  return searchableContent.trim();
}

exports.migrateUsersToTypesense = functions.https.onRequest(
    async (req, res) => {
      try {
        const usersSnapshot = await admin.firestore()
            .collection("users")
            .get();

        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const doc of usersSnapshot.docs) {
          const userData = doc.data();

          try {
          // Prepare the document for Typesense
            const typesenseDoc = {
              id: doc.id.toLowerCase(),
              username: userData.username || "",
              state: userData.state || "",
              subscriptionStatus: userData.subscriptionStatus || "inactive",
              subscriptionType: userData.subscriptionType || "selfAdvocateFree",
              age_str: userData.age ? userData.age.toString() : "",
              age_sort: userData.age ? parseFloat(userData.age) : 0,
              profilePicture: userData.profilePicture || "",
              winTopics: Array.isArray(userData.winTopics) ?
              userData.winTopics :
                         (userData.winTopics ? [userData.winTopics] : []),
              gender: userData.gender || "",
              lookingFor: userData.lookingFor || "",
              questionAnswers: userData.questionAnswers || [],
              _searchableContent: createSearchableContent(userData),
            };

            // Log the document being sent to Typesense
            console.log(
                "Sending to Typesense:",
                JSON.stringify(typesenseDoc, null, 2),
            );

            // Send to Typesense
            await client.collections("users").documents().upsert(typesenseDoc);
            successCount++;
          } catch (error) {
            console.error(`Error processing document ${doc.id}:`, error);
            errorCount++;
            errors.push({
              userId: doc.id,
              error: error.message,
            });
          }
        }

        res.json({
          message: "Migration completed",
          stats: {
            success: successCount,
            errors: errorCount,
            errorDetails: errors,
          },
        });
      } catch (error) {
        console.error("Migration error:", error);
        res.status(500).json({error: error.message});
      }
    },
);

// Add this to force recreation of the collection
exports.recreateTypesenseCollection = functions.https.onRequest(
    async (req, res) => {
      try {
        await createCollection();
        res.json({message: "Collection recreated successfully"});
      } catch (error) {
        console.error("Error recreating collection:", error);
        res.status(500).json({error: error.message});
      }
    });

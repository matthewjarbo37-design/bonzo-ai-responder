const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const BONZO_BASE_URL = "https://app.getbonzo.com/api";
const POLL_INTERVAL_MS = 60000;

const processedMessages = new Set();

app.get("/", (req, res) => {
  res.send("Bonzo AI Polling Responder Running - HOT LEADS ONLY");
});

async function classifyMessage(messageText) {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Classify mortgage lead SMS replies. Return only one category: HOT_LEAD, CALL_REQUESTED, QUESTION, NOT_INTERESTED, WRONG_NUMBER, STOP, UNKNOWN."
        },
        {
          role: "user",
          content: `Message: "${messageText}"`
        }
      ],
      temperature: 0
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.choices[0].message.content.trim();
}

async function generateDraftReply(messageText) {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are Matthew Jarbo's mortgage assistant.

Rules:
- Never quote rates.
- Never quote APR.
- Never guarantee approval.
- Never guarantee savings.
- Never discuss underwriting decisions.
- Never give legal or tax advice.
- Keep responses under 250 characters.
- Ask one qualifying question.
- Move the conversation toward a phone call.
- Be friendly and conversational.
`
        },
        {
          role: "user",
          content: messageText
        }
      ],
      temperature: 0.7
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.choices[0].message.content.trim();
}

async function checkBonzoConversations() {
  try {
    console.log("Checking Bonzo conversations...");

    const response = await axios.get(`${BONZO_BASE_URL}/v3/conversations`, {
      headers: {
        Authorization: `Bearer ${process.env.BONZO_API_KEY}`,
        Accept: "application/json"
      }
    });

    const conversations = response.data?.data || response.data || [];

    for (const convo of conversations) {
      const prospectId = convo.prospect_id || convo.prospectId || convo.id;

      const prospectName =
        convo.name || convo.full_name || convo.prospect_name || "Unknown Prospect";

      const lastMessage =
        convo.last_message ||
        convo.lastMessage ||
        convo.last_incoming_message ||
        convo.lastIncomingMessage ||
        convo.message ||
        null;

      const messageText =
        typeof lastMessage === "string"
          ? lastMessage
          : lastMessage?.content ||
            lastMessage?.message ||
            lastMessage?.body ||
            null;

      const messageId =
        lastMessage?.id ||
        convo.last_message_id ||
        convo.lastMessageId ||
        `${prospectId}-${messageText}`;

      if (!messageText || processedMessages.has(messageId)) continue;

      processedMessages.add(messageId);

      const category = await classifyMessage(messageText);

      if (["STOP", "NOT_INTERESTED", "WRONG_NUMBER", "UNKNOWN"].includes(category)) {
        continue;
      }

      const draftReply = await generateDraftReply(messageText);

      console.log("🔥🔥🔥 HOT / USEFUL REPLY 🔥🔥🔥");
      console.log(`Prospect: ${prospectName}`);
      console.log(`Prospect ID: ${prospectId}`);
      console.log(`Message: ${messageText}`);
      console.log(`AI Category: ${category}`);
      console.log("----- AI DRAFT REPLY -----");
      console.log(draftReply);
      console.log("--------------------------");
      console.log("DRAFT MODE: No text sent.");
      console.log("================================");
    }
  } catch (error) {
    console.error("Polling Error:", error.response?.data || error.message);
  }
}

setInterval(checkBonzoConversations, POLL_INTERVAL_MS);
checkBonzoConversations();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Running on port ${PORT}`);
});

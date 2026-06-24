const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Bonzo AI Responder Running");
});

app.post("/webhook", async (req, res) => {
  try {
    const event = req.body;

    console.log("Webhook Received:", JSON.stringify(event));

    const message =
      "Thanks for reaching out! A member of our team will contact you shortly.";

    const conversationId =
      event.conversation_id ||
      event.conversationId ||
      event.id;

    if (conversationId) {
      await axios.post(
        `https://api.bonzo.com/v3/prospects/send-message/sms/${conversationId}`,
        {
          message: message
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.BONZO_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );
    }

    res.status(200).json({
      success: true
    });
  } catch (error) {
    console.error(error.response?.data || error.message);

    res.status(500).json({
      success: false
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Running on port ${PORT}`);
});

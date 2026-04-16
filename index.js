import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const TOKEN = "YOUR_TOKEN";
const PHONE_ID = "YOUR_PHONE_ID";

// Webhook verify
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    res.send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(403);
  }
});

// Receive message
app.post("/webhook", async (req, res) => {
  const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (msg) {
    const from = msg.from;
    const text = msg.text?.body;

    let reply = "Hello 👋";

    if (text === "hi") {
      reply = "Welcome!\n1. Product A\n2. Product B";
    }

    if (text === "1") {
      reply = "Product A ₹499";
    }

    await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: from,
        text: { body: reply },
      }),
    });
  }

  res.sendStatus(200);
});

app.listen(3000, () => console.log("Server running on port 3000"));
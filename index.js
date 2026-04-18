import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// 🔐 ENV (Render में डालना)
const TOKEN = process.env.TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// 🤖 OpenAI API (optional but recommended)
const OPENAI_KEY = process.env.OPENAI_KEY;

// 📄 Google Sheet
const SHEET_URL = "https://opensheet.elk.sh/YOUR_SHEET_ID/Sheet1";

// 🔍 Sheet से answer
async function getReplyFromSheet(userText) {
  const res = await fetch(SHEET_URL);
  const data = await res.json();

  const found = data.find(
    row => row.question.toLowerCase() === userText.toLowerCase()
  );

  return found ? found.answer : null;
}

// 🤖 AI fallback
async function getAIReply(userText) {
  if (!OPENAI_KEY) return "Sorry, अभी answer available नहीं है";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: userText }],
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "AI error 😅";
}

// 🏠 Test
app.get("/", (req, res) => {
  res.send("Bot running 🚀");
});

// 🔗 Webhook verify
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// 📩 Receive message
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (msg) {
      const from = msg.from;
      const text = msg.text?.body?.toLowerCase();

      let reply = await getReplyFromSheet(text);

      // 👉 अगर Sheet में नहीं मिला → AI
      if (!reply) {
        reply = await getAIReply(text);
      }

      // 👉 Custom command
      if (text === "hi") {
        reply = "Welcome 🙏\nआप क्या जानना चाहते हैं?";
      }

      // 📤 Send reply
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
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running 🚀"));
import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// 🔐 ENV
const TOKEN = process.env.TOKEN;
const PHONE_ID = process.env.PHONE_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const OPENAI_KEY = process.env.OPENAI_KEY;
// 📄 Google Sheet API
const SHEET_INVENTORY = "https://opensheet.elk.sh/1kJn4fJTcylFt3B9MIHH_89NZNuJS7N72LsRtrWI-OPE/Inventory";
const SHEET_FAQ = "https://opensheet.elk.sh/1kJn4fJTcylFt3B9MIHH_89NZNuJS7N72LsRtrWI-OPE/FAQ";

// ⚠️ Order Save API (Google Apps Script URL डालना होगा)
const ORDER_API = "https://script.google.com/macros/s/AKfycbzfZu4PcCq_AxrR1N8ohdBWQ0iitMiBkt6Np5ZjBq7fsXVbk6AbA-vpCv5uFdky2Oxb/exec";

// ==========================
// 🍔 Inventory
// ==========================
async function checkInventory(userText) {
  const res = await fetch(SHEET_INVENTORY);
  const data = await res.json();

  const found = (Array.isArray(data) ? data : (data.data || [])).find(
  row => (row["Food Item"] || row[0] || "").toLowerCase() === userText.toLowerCase()
);

  if (found) {
    return `${found["Food Item"]} 👉 ${found["Status"]} (Qty: ${found["Quantity"]})`;
  }
  return null;
}

// ==========================
// ❓ FAQ
// ==========================
async function getFAQ(userText) {
  const res = await fetch(SHEET_FAQ);
  const data = await res.json();

  const list = Array.isArray(data) ? data : (data.data || []);

const found = list.find(
  row => (row.Question || "").toLowerCase().includes(userText.toLowerCase())
);

  return found ? found.Answer : null;
}

// ==========================
// 🧾 SAVE ORDER
// ==========================
async function saveOrder(user, item) {
  if (!ORDER_API) return;

  await fetch(ORDER_API, {
    method: "POST",
    body: JSON.stringify({
      phone: user,
      item: item,
      time: new Date().toLocaleString()
    }),
    headers: { "Content-Type": "application/json" }
  });
}

// ==========================
// 🤖 AI fallback
// ==========================
async function getAIReply(userText) {
  if (!OPENAI_KEY) return "Sorry, answer नहीं मिला 😅";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: userText }]
    })
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "AI error";
}

// ==========================
// ROUTES
// ==========================
app.get("/", (req, res) => res.send("Bot running 🚀"));

// Webhook verify
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.send(req.query["hub.challenge"]);
  }
  res.sendStatus(403);
});

// ==========================
// MAIN LOGIC
// ==========================
app.post("/webhook", async (req, res) => {
  try {
    const msg = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (msg) {
      const from = msg.from;
      const text = msg.text?.body?.toLowerCase();

      let reply = null;

      // 👉 ORDER COMMAND
      if (text.startsWith("order")) {
        const item = text.replace("order", "").trim();

        await saveOrder(from, item);

        reply = `✅ Order received: ${item}\nधन्यवाद 🙏`;
      }

      // 👉 Inventory
      if (!reply) {
        reply = await checkInventory(text);
      }

      // 👉 FAQ
      if (!reply) {
        reply = await getFAQ(text);
      }

      // 👉 AI
      if (!reply) {
        reply = await getAIReply(text);
      }

      // 👉 Greeting
      if (text === "hi") {
        reply = "Welcome 🙏\norder pizza लिखकर order करें";
      }

      // Send message
      await fetch(`https://graph.facebook.com/v19.0/${PHONE_ID}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: from,
          text: { body: reply }
        })
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// Start server
app.listen(process.env.PORT || 3000, () =>
  console.log("Server running 🚀")
);
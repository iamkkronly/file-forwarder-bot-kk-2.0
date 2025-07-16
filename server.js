const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

// === CONFIGURATION ===
const BOT_TOKEN = "7559283575:AAGMzyfFWxhEkrGhRuTott6Jn2M6LUDADlc";
const YOUR_NAME = "Kaustav Ray";

const SUPABASE_URL = "https://vtgwzybxbmycbjpocign.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0Z3d6eWJ4Ym15Y2JqcG9jaWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTc4ODgsImV4cCI6MjA2ODIzMzg4OH0.vljSSfEB1onFHA4ou9owdSb4uknt4SZNaC5idgg7q8g";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// === Express Setup ===
const app = express();
app.get("/", (req, res) => res.send("🤖 Bot is running!"));
app.listen(process.env.PORT || 3000, () => {
  console.log("✅ Express server running...");
});

let adminChannels = new Set();

async function initSupabase() {
  const { data, error } = await supabase.from("channels").select("id");
  if (error) {
    console.error("❌ Failed to load channels from Supabase:", error.message);
    return;
  }
  data.forEach((ch) => adminChannels.add(ch.id));
  console.log(`📂 Loaded ${adminChannels.size} channels from Supabase`);
}

async function saveChannelToSupabase(id, title) {
  const { error } = await supabase
    .from("channels")
    .upsert({ id, title }, { onConflict: "id" });

  if (error) {
    console.error(`❌ Failed to save channel ${title} (${id}):`, error.message);
  } else {
    adminChannels.add(id);
    console.log(`💾 Saved new channel: ${title} (${id})`);
  }
}

function formatCaption(text) {
  return (text || "") + "\n\n" + YOUR_NAME;
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.on("my_chat_member", async (msg) => {
  const chat = msg.chat;
  const status = msg.new_chat_member.status;

  if (chat.type === "channel" && (status === "administrator" || status === "creator")) {
    await saveChannelToSupabase(chat.id, chat.title || "Untitled");
    console.log(`✅ Bot added as admin in: ${chat.title || chat.id}`);
  }
});

bot.on("message", async (msg) => {
  if (!msg || msg.chat.type !== "private") return;

  const caption = formatCaption(msg.caption || msg.text || "");
  console.log(`📩 Received message from ${msg.from.username || msg.from.id}`);

  if (adminChannels.size === 0) {
    bot.sendMessage(msg.chat.id, "⚠️ I'm not admin in any channel yet.");
    return;
  }

  for (let channelId of adminChannels) {
    try {
      if (msg.photo) {
        await bot.sendPhoto(channelId, msg.photo.at(-1).file_id, { caption });
      } else if (msg.video) {
        await bot.sendVideo(channelId, msg.video.file_id, { caption });
      } else if (msg.document) {
        await bot.sendDocument(channelId, msg.document.file_id, { caption });
      } else if (msg.audio) {
        await bot.sendAudio(channelId, msg.audio.file_id, { caption });
      } else if (msg.voice) {
        await bot.sendVoice(channelId, msg.voice.file_id, { caption });
      } else if (msg.text) {
        await bot.sendMessage(channelId, caption);
      } else {
        await bot.sendMessage(channelId, `⚠️ Unsupported content.\n\n${caption}`);
      }
      console.log(`📤 Forwarded to ${channelId}`);
    } catch (err) {
      console.error(`❌ Failed to send to ${channelId}:`, err.message);
    }
  }

  bot.sendMessage(msg.chat.id, "✅ Forwarded to all admin channels.");
});

// Auto restart every 1 hour to keep Render happy
setTimeout(() => {
  console.log("♻️ Auto restarting bot after 1 hour...");
  process.exit(0);
}, 3600000);

initSupabase()
  .then(() => {
    console.log("🚀 Bot started at", new Date().toLocaleString());
  })
  .catch((err) => {
    console.error("❌ Supabase init failed:", err.message);
    process.exit(1);
  });

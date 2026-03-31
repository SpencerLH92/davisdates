const fs = require("fs");
const axios = require("axios");

const BOT_ID = process.env.BOT_ID;
const TIMEZONE = process.env.TIMEZONE || "America/Chicago";

if (!BOT_ID) {
  throw new Error("Missing BOT_ID environment variable.");
}

function loadBirthdays() {
  const raw = fs.readFileSync("./birthdays.json", "utf8");
  return JSON.parse(raw);
}

function getCentralDateParts() {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "long"
  }).formatToParts(now);

  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    weekday: values.weekday
  };
}

function monthName(month) {
  return new Date(2000, month - 1, 1).toLocaleString("en-US", {
    month: "long"
  });
}

function formatDate(month, day) {
  return `${month}/${day}`;
}

function birthdaysThisMonth(birthdays, month) {
  return birthdays
    .filter(b => b.month === month)
    .sort((a, b) => a.day - b.day);
}

function birthdaysToday(birthdays, month, day) {
  return birthdays.filter(b => b.month === month && b.day === day);
}

function birthdaysThisWeek(birthdays, year, month, day) {
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 6);

  return birthdays
    .filter(person => {
      let birthday = new Date(year, person.month - 1, person.day);

      if (birthday < start) {
        birthday = new Date(year + 1, person.month - 1, person.day);
      }

      return birthday >= start && birthday <= end;
    })
    .sort((a, b) => {
      const dateA = new Date(year, a.month - 1, a.day);
      const dateB = new Date(year, b.month - 1, b.day);
      return dateA - dateB;
    });
}

async function sendMessage(text) {
  await axios.post("https://api.groupme.com/v3/bots/post", {
    bot_id: BOT_ID,
    text
  });
  console.log("Sent:", text);
}

async function main() {
  const birthdays = loadBirthdays();
  const today = getCentralDateParts();

  console.log(`Checking birthdays for ${today.month}/${today.day} (${today.weekday})`);

  if (today.day === 1) {
    const monthly = birthdaysThisMonth(birthdays, today.month);
    if (monthly.length > 0) {
      const lines = monthly.map(p => `• ${p.name} - ${formatDate(p.month, p.day)}`);
      await sendMessage(
        `🎉 Birthdays coming up in ${monthName(today.month)}:\n\n${lines.join("\n")}`
      );
    }
  }

  if (today.weekday === "Sunday") {
    const weekly = birthdaysThisWeek(
      birthdays,
      today.year,
      today.month,
      today.day
    );
    if (weekly.length > 0) {
      const lines = weekly.map(p => `• ${p.name} - ${formatDate(p.month, p.day)}`);
      await sendMessage(`📅 Birthday reminder for this week:\n\n${lines.join("\n")}`);
    }
  }

  const todays = birthdaysToday(birthdays, today.month, today.day);
  if (todays.length > 0) {
    const names = todays.map(p => p.name).join(" and ");
    await sendMessage(`🎂 Happy Birthday ${names}!`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

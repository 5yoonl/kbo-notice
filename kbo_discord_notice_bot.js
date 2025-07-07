// kbo_discord_notice_bot_refactored.js (Railway/로컬 안정화 리팩토링 풀코드)

import "dotenv/config";
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import cron from "node-cron";
import fs from "fs";

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

if (!TOKEN || !CHANNEL_ID) {
  console.error(
    "❌ DISCORD_TOKEN 또는 CHANNEL_ID 환경변수가 설정되지 않았습니다."
  );
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});
let schedule;
try {
  schedule = JSON.parse(fs.readFileSync("./samsung_schedule.json", "utf-8"));
} catch (err) {
  console.error("❌ samsung_schedule.json 로드 실패:", err);
  process.exit(1);
}

function getTeamLogo(teamName) {
  const teamCodeMap = {
    삼성: "SS",
    한화: "HH",
    롯데: "LT",
    LG: "LG",
    두산: "OB",
    NC: "NC",
    SSG: "SK",
    키움: "WO",
    KIA: "HT",
    KT: "KT",
  };
  const code = teamCodeMap[teamName] || "SS";
  return `https://sports-phinf.pstatic.net/team/kbo/default/${code}.png`;
}

function getOpponent(game) {
  if (game.home_team === "삼성") return `${game.away_team} (홈)`;
  if (game.away_team === "삼성") return `${game.home_team} (원정)`;
  return "경기 정보 오류";
}

function createEmbed(game, isTomorrow = false) {
  const samsungLogo = getTeamLogo("삼성");
  return new EmbedBuilder()
    .setColor(0x005bac)
    .setTitle(`⚾️ ${isTomorrow ? "내일의" : "오늘의"} 삼성라이온즈 경기 알림`)
    .setThumbnail(samsungLogo)
    .addFields(
      { name: "📅 날짜", value: game.date, inline: true },
      { name: "🕖 시간", value: game.time, inline: true },
      { name: "🏟️ 구장", value: game.stadium, inline: true },
      { name: "⚔️ 상대", value: getOpponent(game), inline: false }
    )
    .setFooter({ text: "삼성라이온즈 알림봇" })
    .setTimestamp();
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  let channel;
  try {
    channel = await client.channels.fetch(CHANNEL_ID);
  } catch (err) {
    console.error("❌ 채널 가져오기 실패:", err);
    process.exit(1);
  }

  // ✅ 전날 20:00 (KST, UTC 11:00) 내일 경기 알림
  cron.schedule("45 11 * * *", async () => {
    console.log("🚀 내일 경기 알림 cron 실행");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];
    const game = schedule.find((g) => g.date === dateStr);

    try {
      if (game) {
        const embed = createEmbed(game, true);
        await channel.send({ embeds: [embed] });
      } else {
        await channel.send(
          `⚾️ 내일(${dateStr}) 삼성라이온즈 경기가 없습니다.`
        );
      }
    } catch (err) {
      console.error("❌ 내일 경기 알림 전송 실패:", err);
    }
  });

  // ✅ 경기 15분 전 알림 예약 등록 (매일 00:00 UTC = 09:00 KST)
  cron.schedule("0 0 * * *", async () => {
    console.log("🚀 경기 15분 전 알림 예약 cron 실행");
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    const game = schedule.find((g) => g.date === dateStr);

    if (!game) {
      console.log("⚾️ 오늘 경기 없음 - 15분 전 알림 예약 스킵");
      return;
    }

    const [hour, minute] = game.time.split(":").map(Number);
    if (isNaN(hour) || isNaN(minute)) {
      console.error("❌ 경기 시간 파싱 오류:", game.time);
      return;
    }

    let notifyHour = hour;
    let notifyMinute = minute - 15;
    if (notifyMinute < 0) {
      notifyMinute += 60;
      notifyHour -= 1;
    }
    const cronTime = `${notifyMinute} ${notifyHour} * * *`;
    console.log(`✅ 오늘 경기 15분 전 알림 예약됨: ${cronTime} KST`);

    cron.schedule(cronTime, async () => {
      console.log("🚀 경기 15분 전 알림 cron 실행");
      try {
        const embed = createEmbed(game, false);
        await channel.send({ embeds: [embed] });
      } catch (err) {
        console.error("❌ 경기 15분 전 알림 전송 실패:", err);
      }
    });
  });
});

client.login(TOKEN);

import "dotenv/config";
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import cron from "node-cron";
import fs from "fs";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

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

function createEmbed(game) {
  const homeLogo = getTeamLogo(game.home_team);
  const awayLogo = getTeamLogo(game.away_team);
  const homeOrAway = game.home_team === "삼성" ? "홈" : "원정";

  return new EmbedBuilder()
    .setColor(0x005bac)
    .setTitle("⚾️ 오늘의 삼성라이온즈 경기 알림")
    .setThumbnail(homeLogo)
    .addFields(
      { name: "📅 날짜", value: game.date, inline: true },
      { name: "🕖 시간", value: game.time, inline: true },
      { name: "🏟️ 구장", value: game.stadium, inline: true },
      {
        name: "⚔️ 상대",
        value: `${game.away_team} (${homeOrAway})`,
        inline: false,
      }
    )
    .setFooter({ text: "삼성라이온즈 알림봇" })
    .setTimestamp();
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const channel = await client.channels.fetch(CHANNEL_ID);
  const schedule = JSON.parse(
    fs.readFileSync("./samsung_schedule.json", "utf-8")
  );

  // 전날 20:00 알림
  cron.schedule("0 20 * * *", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    const game = schedule.find((g) => g.date === dateStr);

    if (game) {
      const embed = createEmbed(game);
      await channel.send({ embeds: [embed] });
    } else {
      await channel.send(`⚾️ 내일(${dateStr}) 삼성라이온즈 경기가 없습니다.`);
    }
  });

  // 매일 09:00 오늘 경기 15분 전 알림 예약
  cron.schedule("0 9 * * *", async () => {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    const game = schedule.find((g) => g.date === dateStr);

    if (!game) {
      console.log("⚾️ 오늘 경기 없음 - 경기 15분 전 알림 예약 스킵");
      return;
    }

    const [hour, minute] = game.time.split(":").map(Number);
    let notifyHour = hour;
    let notifyMinute = minute - 15;
    if (notifyMinute < 0) {
      notifyMinute += 60;
      notifyHour -= 1;
    }
    const cronTime = `${notifyMinute} ${notifyHour} * * *`;
    console.log(`✅ 오늘 경기 15분 전 알림 예약: ${cronTime}`);

    cron.schedule(cronTime, async () => {
      const embed = createEmbed(game);
      await channel.send({ embeds: [embed] });
    });
  });
});

client.login(TOKEN);

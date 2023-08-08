# 🔊 Discord VoiceConnection

## Exemple

```js
const { Client, Intents } = require("discord.js");
const VoiceConnection = require("./VoiceConnection");
const ytdl = require("ytdl-core");
const config = require("./config.json");

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_VOICE_STATES
    ]
});

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);

    const conn = new VoiceConnection(client, "CHANNEL_ID");
    conn.join().then(() => {
        console.log("joined");
        conn.play(
            ytdl("VIDEO_URL", {
                filter: "audioonly",
                highWaterMark: 1 << 62,
                liveBuffer: 1 << 62,
                dlChunkSize: 0
            })
        ).then((emitter) => {
            emitter.on("playing", () => console.log("playing..."));
            emitter.on("idle", () => console.log("idle (ended)"));
        });
    });
});

client.on("voiceStateUpdate", async (oldState, newState) => {
    if(
        newState.channelId
        && newState.channel.type === "GUILD_STAGE_VOICE"
        && newState.guild.members.me.voice.suppress
    ) {
        await newState.guild.members.me.voice.setSuppressed(false).catch(() => {});
    };
});

client.login("TOKEN");
```

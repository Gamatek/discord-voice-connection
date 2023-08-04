# discord-voice-connection

## Exemple

```js
const { Client, Intents, Collection } = require("discord.js");
const VoiceConnection = require("./VoiceConnection");
const ytdl = require("ytdl-core");
const config = require("./config.json");

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_VOICE_STATES
    ]
});

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);

    const conn = new VoiceConnection(client, "897205524481851422");
    conn.join().then(() => {
        console.log("joined");
        conn.play(
            ytdl("https://www.youtube.com/watch?v=Wt2fuNtgYDM&pp=ygUFc2F5YW4%3D", {
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

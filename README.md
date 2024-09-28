# 🔊 Discord Voice Connection Wrapper

This project provides a wrapper class for managing voice connections in Discord bots using the discord.js library and @discordjs/voice package.

## Features

- Join and leave voice channels
- Play audio streams
- Pause and unpause playback
- Control audio volume
- Error handling with custom error class

## Installation

To use this wrapper, make sure you have the following dependencies installed:

```bash
npm install discord.js @discordjs/voice
```

## Usage

First, import the `VoiceConnection` class:

```javascript
const VoiceConnection = require("./VoiceConnection");
```

Then, you can use it in your Discord bot as follows:

```javascript
const { Client, Intents } = require("discord.js");
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES] });

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", async (message) => {
    if (message.content === "!join") {
        const voiceConnection = new VoiceConnection(client, message.member.voice.channel.id);
        try {
            await voiceConnection.join();
            message.reply("Joined the voice channel!");
        } catch (error) {
            message.reply(`Failed to join: ${error.message}`);
        };
    };
});

client.login("YOUR_BOT_TOKEN");
```

## API

### `VoiceConnection`

#### Constructor

- `constructor(client, channelId)`: Creates a new VoiceConnection instance.
- `client`: Discord.js Client instance.
- `channelId`: 

#### Methods

- `join(maxListeners)`: Joins a voice channel.
- `destroy()`: Leaves the voice channel.
- `play(stream, volume)`: Plays an audio stream.
- `pause(rejectIfAlreadyPaused)`: Pauses the current playback.
- `unpause(rejectIfNotPaused)`: Unpauses the current playback.
- `isPaused()`: Checks if the playback is paused.
- `getVolume()`: Gets the current volume.
- `setVolume(volume)`: Sets the playback volume.

## Error Handling

The wrapper uses a custom `VoiceConnectionError` class to handle various error scenarios. Error codes include:

- `NO_CONNECTION`
- `MISSING_PERMISSIONS`
- `CONNECTION_NOT_READY`
- `NO_RESOURCE`
- `PLAYER_ALREADY_PAUSED`
- `PLAYER_NOT_PAUSED`

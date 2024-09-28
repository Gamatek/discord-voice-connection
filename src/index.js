const { Client } = require("discord.js");
const { EventEmitter } = require("events");
const {
    joinVoiceChannel,
    getVoiceConnection,
    createAudioResource,
    createAudioPlayer,
    VoiceConnectionStatus,
    AudioPlayerStatus
} = require("@discordjs/voice");

/**
 * Custom error class for voice connection errors.
 * @extends Error
 */
class VoiceConnectionError extends Error {
    /**
     * @param {string} code - The error code.
     * @param {string} [message] - The error message.
     */
    constructor(code, message) {
        super(VoiceConnectionError.messages[code] || message);
        this.code = code;
        this.name = 'VoiceConnectionError';
    }

    static messages = {
        NO_CONNECTION: "The client was not connected to this channel.",
        MISSING_PERMISSIONS: "The client does not have permissions.",
        CONNECTION_NOT_READY: "The connection is not ready to play.",
        NO_RESOURCE: "No resource was provided.",
        PLAYER_ALREADY_PAUSED: "The player is already paused.",
        PLAYER_NOT_PAUSED: "The player is not paused."
    };
};

/**
 * Represents a voice connection to a Discord channel.
 */
class VoiceConnection {
    /**
     * Create a VoiceConnection.
     * @param {Client} client - The Discord.js client.
     * @param {string} channelId - The ID of the voice channel to connect to.
     */
    constructor (client, channelId) {
        this.client = client;
        this.channelId = channelId;
        this.guildId = null;
        this.player = null;
        this.resource = null;
    };

    /**
     * Get the voice connection for the current guild.
     * @returns {import("@discordjs/voice").VoiceConnection | null}
     */
    getConnection() {
        return this.guildId ? getVoiceConnection(this.guildId) : null;
    };

    /**
     * Check if the connection is ready.
     * @returns {boolean}
     */
    isConnectionReady() {
        const connection = this.getConnection();
        return connection && connection.state.status === VoiceConnectionStatus.Ready;
    };

    /**
     * Check if the audio playback is paused.
     * @returns {boolean} The paused state.
     * @throws {VoiceConnectionError} If the check fails.
     */
    isPaused() {
        if (!this.isConnectionReady()) {
            throw new VoiceConnectionError("CONNECTION_NOT_READY");
        };
        return this.player.state.status === AudioPlayerStatus.Paused;
    };

    /**
     * Join the voice channel.
     * @param {number} [maxListeners] - The maximum number of listeners for the connection.
     * @returns {Promise<void>} A promise that resolves when connected.
     * @throws {VoiceConnectionError} If connection fails.
     */
    async join(maxListeners) {
        try {
            const channel = await this.client.channels.fetch(this.channelId);
            this.guildId = channel.guildId;

            if (this.isConnectionReady()) {
                return;
            };

            const permissions = channel.permissionsFor(channel.guild.members.me);
            if (!permissions.has(["VIEW_CHANNEL", "CONNECT", "SPEAK"])) {
                throw new VoiceConnectionError("MISSING_PERMISSIONS");
            };

            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guildId,
                adapterCreator: channel.guild.voiceAdapterCreator
            });

            if (maxListeners) connection.setMaxListeners(maxListeners);

            await new Promise((resolve, reject) => {
                connection.once(VoiceConnectionStatus.Ready, resolve);
                connection.once("error", reject);
            });
        } catch (err) {
            throw new VoiceConnectionError("NO_CHANNEL", err.message);
        };
    };

    /**
     * Destroy the voice connection.
     * @returns {Promise<void>} A promise that resolves when disconnected.
     * @throws {VoiceConnectionError} If disconnection fails.
     */
    async destroy() {
        const connection = this.getConnection();
        if (!connection) {
            throw new VoiceConnectionError("NO_CONNECTION");
        };

        await new Promise((resolve) => {
            connection.once(VoiceConnectionStatus.Destroyed, resolve);
            connection.destroy();
        });
    };

    /**
     * Play an audio stream in the voice channel.
     * @param {ReadableStream} stream - The audio stream to play.
     * @param {number} [volume=1] - The volume of the audio (0 to 1).
     * @returns {Promise<EventEmitter>} A promise that resolves with an EventEmitter for the player.
     * @throws {VoiceConnectionError} If playback fails to start.
     */
    async play(stream, volume = 1) {
        if (!this.isConnectionReady()) {
            throw new VoiceConnectionError("CONNECTION_NOT_READY");
        };

        this.resource = createAudioResource(stream, { inlineVolume: true });
        this.resource.volume.setVolume(volume);
        this.player = createAudioPlayer();

        const emitter = new EventEmitter();

        this.player.once(AudioPlayerStatus.Playing, () => emitter.emit("playing"));
        this.player.once(AudioPlayerStatus.Idle, () => emitter.emit("idle"));
        this.player.once("error", (err) => emitter.emit("error", err));

        this.player.play(this.resource);
        this.getConnection().subscribe(this.player);

        return emitter;
    };

    /**
     * Pause the current audio playback.
     * @param {boolean} [rejectIfAlreadyPaused=true] - Whether to reject if already paused.
     * @returns {Promise<void>} A promise that resolves when paused.
     * @throws {VoiceConnectionError} If pausing fails.
     */
    async pause(rejectIfAlreadyPaused = true) {
        if (!this.isConnectionReady()) {
            throw new VoiceConnectionError("CONNECTION_NOT_READY");
        };

        if (this.player.state.status === AudioPlayerStatus.Paused) {
            if (rejectIfAlreadyPaused) {
                throw new VoiceConnectionError("PLAYER_ALREADY_PAUSED");
            }
            return;
        };

        await new Promise((resolve) => {
            this.player.once(AudioPlayerStatus.Paused, resolve);
            this.player.pause();
        });
    };

    /**
     * Unpause the current audio playback.
     * @param {boolean} [rejectIfNotPaused=true] - Whether to reject if not paused.
     * @returns {Promise<void>} A promise that resolves when unpaused.
     * @throws {VoiceConnectionError} If unpausing fails.
     */
    async unpause(rejectIfNotPaused = true) {
        if (!this.isConnectionReady()) {
            throw new VoiceConnectionError("CONNECTION_NOT_READY");
        };

        if (this.player.state.status !== AudioPlayerStatus.Paused) {
            if (rejectIfNotPaused) {
                throw new VoiceConnectionError("PLAYER_NOT_PAUSED");
            }
            return;
        };

        await new Promise((resolve) => {
            this.player.once(AudioPlayerStatus.Playing, resolve);
            this.player.unpause();
        });
    };

    /**
     * Check if the audio playback is paused.
     * @returns {Promise<boolean>} A promise that resolves with the paused state.
     * @throws {VoiceConnectionError} If the check fails.
     */
    isPaused() {
        if (!this.isConnectionReady()) {
            throw new VoiceConnectionError("CONNECTION_NOT_READY");
        };
        return this.player.state.status === AudioPlayerStatus.Paused;
    };

    /**
     * Get the current volume of the audio playback.
     * @returns {Promise<number>} A promise that resolves with the current volume.
     * @throws {VoiceConnectionError} If getting the volume fails.
     */
    getVolume() {
        if (!this.isConnectionReady()) {
            throw new VoiceConnectionError("CONNECTION_NOT_READY");
        };
        if (!this.resource) {
            throw new VoiceConnectionError("NO_RESOURCE");
        };
        return this.resource.volume.volume;
    };

    /**
     * Set the volume of the audio playback.
     * @param {number} volume - The new volume (0 to 1).
     * @returns {Promise<void>} A promise that resolves when the volume is set.
     * @throws {VoiceConnectionError} If setting the volume fails.
     */
    setVolume(volume) {
        if (!this.isConnectionReady()) {
            throw new VoiceConnectionError("CONNECTION_NOT_READY");
        };
        if (!this.resource) {
            throw new VoiceConnectionError("NO_RESOURCE");
        };
        this.resource.volume.setVolume(volume);
    };
};

module.exports = VoiceConnection;
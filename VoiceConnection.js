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

class VoiceConnectionError extends Error {
    constructor (code, message) {
        super();
        this.code = code;
        this.message = {
            NO_CONNECTION: "The client was not connected to this channel.",
            MISSING_PERMISSIONS: "The client do not have permissions.",
            CONNECTION_NOT_READY: "The connection is not ready to play.",
            NO_RESOURCE: "No resource were provided.",
            PLAYER_ALREADY_PAUSED: "The player is already paused."
        }[code] || message;
    };
};

class VoiceConnection {
    /**
     * @param {Client} client 
     * @param {String} channelId 
     */
    constructor (client, channelId) {
        this.client = client;
        this.channelId = channelId;
        this.guildId = null;
        this.player = null;
        this.resource = null;
    };

    join(maxListeners) {
        return new Promise((resolve, reject) => {
            this.client.channels.fetch(this.channelId).then((channel) => {
                this.channel = channel;
                this.guildId = channel.guildId;
                const connection = getVoiceConnection(channel.guildId);
                if(connection && connection.state.status === VoiceConnectionStatus.Ready) {
                    resolve();
                } else {
                    if(channel.permissionsFor(channel.guild.members.me).has([ "VIEW_CHANNEL", "CONNECT", "SPEAK" ])) {
                        const connection = joinVoiceChannel({
                            channelId: channel.id,
                            guildId: channel.guildId,
                            adapterCreator: channel.guild.voiceAdapterCreator
                        });
                        if(maxListeners) connection.setMaxListeners(maxListeners);

                        connection.once(VoiceConnectionStatus.Ready, () => resolve());
                        connection.once("error", (err) => reject(err))
                    } else {
                        reject(new VoiceConnectionError("MISSING_PERMISSIONS"));
                    };
                };
            }).catch((err) => {
                reject(new VoiceConnectionError("NO_CHANNEL", err.message));
            });
        });
    };

    destroy() {
        return new Promise((resolve, reject) => {
            const connection = getVoiceConnection(this.guildId);
            if(connection) {
                connection.once(VoiceConnectionStatus.Destroyed, () => resolve());
                connection.destroy();
            } else {
                reject(new VoiceConnectionError("NO_CONNECTION"));
            };
        });
    };

    play(stream, volume = 1) {
        return new Promise((resolve, reject) => {
            const connection = getVoiceConnection(this.guildId);
            if(connection) {
                if(connection.state.status === VoiceConnectionStatus.Ready) {
                    this.resource = createAudioResource(stream, { inlineVolume: true });
                    this.resource.volume.setVolume(volume);
                    this.player = createAudioPlayer();

                    const emitter = new EventEmitter();

                    this.player.once(AudioPlayerStatus.Playing, () => emitter.emit("playing"));
                    this.player.once(AudioPlayerStatus.Idle, () => emitter.emit("idle"));
                    this.player.once("error", (err) => emitter.emit("error", err));

                    resolve(emitter);

                    this.player.play(this.resource);
                    connection.subscribe(this.player);
                } else {
                    reject(new VoiceConnectionError("CONNECTION_NOT_READY"));
                };
            } else {
                reject(new VoiceConnectionError("NO_CONNECTION"));
            };
        });
    };

    pause(rejectIfAlreadyPaused = true) {
        return new Promise((resolve, reject) => {
            const connection = getVoiceConnection(this.guildId);
            if(connection) {
                if(connection.state.status === VoiceConnectionStatus.Ready) {
                    if(this.player.state.status === AudioPlayerStatus.Paused) {
                        if(rejectIfAlreadyPaused) {
                            reject(new VoiceConnectionError("PLAYER_ALREADY_PAUSED"));
                        } else {
                            resolve();
                        };
                    } else {
                        this.player.once(AudioPlayerStatus.Paused, () => resolve());
                        this.player.pause();
                    };
                } else {
                    reject(new VoiceConnectionError("CONNECTION_NOT_READY"));
                };
            } else {
                reject(new VoiceConnectionError("NO_CONNECTION"));
            };
        });
    };

    unpause(rejectIfNotPaused = true) {
        return new Promise((resolve, reject) => {
            const connection = getVoiceConnection(this.guildId);
            if(connection) {
                if(connection.state.status === VoiceConnectionStatus.Ready) {
                    if(this.player.state.status === AudioPlayerStatus.Paused) {
                        this.player.once(AudioPlayerStatus.Playing, () => resolve());
                        this.player.unpause();
                    } else {
                        if(rejectIfNotPaused) {
                            reject(new VoiceConnectionError("PLAYER_NOT_PAUSED"));
                        } else {
                            resolve();
                        };
                    };
                } else {
                    reject(new VoiceConnectionError("CONNECTION_NOT_READY"));
                };
            } else {
                reject(new VoiceConnectionError("NO_CONNECTION"));
            };
        });
    };

    isPaused() {
        return new Promise((resolve, reject) => {
            const connection = getVoiceConnection(this.guildId);
            if(connection) {
                if(connection.state.status === VoiceConnectionStatus.Ready) {
                    resolve(this.player.state.status === AudioPlayerStatus.Paused);
                } else {
                    reject(new VoiceConnectionError("CONNECTION_NOT_READY"));
                };
            } else {
                reject(new VoiceConnectionError("NO_CONNECTION"));
            };
        });
    };

    getVolume() {
        return new Promise((resolve, reject) => {
            const connection = getVoiceConnection(this.guildId);
            if(connection) {
                if(connection.state.status === VoiceConnectionStatus.Ready) {
                    if(this.resource) {
                        resolve(this.resource.volume.volume);
                    } else {
                        reject(new VoiceConnectionError("NO_RESOURCE"));
                    };
                } else {
                    reject(new VoiceConnectionError("CONNECTION_NOT_READY"));
                };
            } else {
                reject(new VoiceConnectionError("NO_CONNECTION"));
            };
        });
    };

    setVolume(volume) {
        return new Promise((resolve, reject) => {
            const connection = getVoiceConnection(this.guildId);
            if(connection) {
                if(connection.state.status === VoiceConnectionStatus.Ready) {
                    if(this.resource) {
                        this.resource.volume.setVolume(volume);
                        resolve();
                    } else {
                        reject(new VoiceConnectionError("NO_RESOURCE"));
                    };
                } else {
                    reject(new VoiceConnectionError("CONNECTION_NOT_READY"));
                };
            } else {
                reject(new VoiceConnectionError("NO_CONNECTION"));
            };
        });
    };
};

module.exports = VoiceConnection;
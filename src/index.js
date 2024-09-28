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
    };

    join(maxListeners) {
        return new Promise((resolve, reject) => {
            this.client.channels.fetch(this.channelId).then((channel) => {
                this.channel = channel;
                this.guildId = channel.guildId;
                const connection = getVoiceConnection(channel.guildId);
                if(connection?.state?.status === VoiceConnectionStatus.Ready) {
                    resolve();
                } else {
                    if(channel.permissionsFor(channel.guild.members.me).has([ "VIEW_CHANNEL", "CONNECT", "SPEAK" ])) {
                        const connection = joinVoiceChannel({
                            channelId: channel.id,
                            guildId: channel.guildId,
                            adapterCreator: channel.guild.voiceAdapterCreator
                        });
                        if(maxListeners) connection.setMaxListeners(maxListeners);

                        const onError = (err) => {
                            connection.removeListener("error", onError);
                            reject(err);
                        };

                        const onReady = () => {
                            connection.removeListener(VoiceConnectionStatus.Ready, onReady);
                            resolve();
                        };

                        connection.on("error", onError)
                        connection.on(VoiceConnectionStatus.Ready, onReady);
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
                const onDestroyed = () => {
                    connection.removeListener(VoiceConnectionStatus.Destroyed, onDestroyed);
                    resolve();
                };

                connection.on(VoiceConnectionStatus.Destroyed, onDestroyed);

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
                    this._resource = createAudioResource(stream, { inlineVolume: true });
                    this._resource.volume.setVolume(volume);
                    this._player = createAudioPlayer();

                    const emitter = new EventEmitter();

                    const onPlaying = () => {
                        this._player.removeListener(AudioPlayerStatus.Playing, onPlaying);
                        emitter.emit("playing");
                    };

                    const onIdle = () => {
                        this._player.removeListener(AudioPlayerStatus.Idle, onIdle);
                        emitter.emit("idle");
                    };

                    const onError = (err) => {
                        this._player.removeListener("error", onError);
                        emitter.emit("error", err);
                    };

                    this._player.on(AudioPlayerStatus.Playing, onPlaying);
                    this._player.on(AudioPlayerStatus.Idle, onIdle);
                    this._player.on("error", onError);
                    resolve(emitter);

                    this._player.play(this._resource);
                    connection.subscribe(this._player);
                } else {
                    reject(new VoiceConnectionError("CONNECTION_NOT_READY"));
                };
            } else {
                reject(new VoiceConnectionError("NO_CONNECTION" ));
            };
        });
    };

    pause(rejectIfAlreadyPaused = true) {
        return new Promise((resolve, reject) => {
            const connection = getVoiceConnection(this.guildId);
            if(connection) {
                if(connection.state.status === VoiceConnectionStatus.Ready) {
                    if(this._player.state.status === AudioPlayerStatus.Paused) {
                        if(rejectIfAlreadyPaused) {
                            reject(new VoiceConnectionError("PLAYER_ALREADY_PAUSED"));
                        } else {
                            resolve();
                        };
                    } else {
                        const onPaused = () => {
                            this._player.removeListener(AudioPlayerStatus.Paused, onPaused);
                            resolve();
                        };

                        this._player.on(AudioPlayerStatus.Paused, onPaused);

                        this._player.pause();
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
                    if(this._player.state.status === AudioPlayerStatus.Paused) {
                        const onPlaying = () => {
                            this._player.removeListener(AudioPlayerStatus.Playing, onPlaying);
                            resolve();
                        };

                        this._player.on(AudioPlayerStatus.Playing, onPlaying);

                        this._player.unpause();
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
                    resolve(this._player.state.status === AudioPlayerStatus.Paused);
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
                    if(this._resource) {
                        resolve(this._resource.volume.volume);
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
                    if(this._resource) {
                        this._resource.volume.setVolume(volume);
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

const Discord = require("discord.js");
const ytdl = require("ytdl-core");
const { Client, Util } = require('discord.js');
const getYoutubeID = require('get-youtube-id');
const fetchVideoInfo = require('youtube-info');
const YouTube = require('simple-youtube-api');
const youtube = new YouTube("AIzaSyAdORXg7UZUo7sePv97JyoDqtQVi3Ll0b8");
const queue = new Map();
const client = new Discord.Client();

const prefix = "#"

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setStatus("idle")
    
});




client.on('message', message => {
  if(message.content === prefix + 'invite') {
    message.channel.send(`**Link :link: ** **https://discordapp.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot**`);
  }
});



client.on('message', async msg => { 
	if (msg.author.bot) return undefined;
	
	if (!msg.content.startsWith(prefix)) return undefined;
	const args = msg.content.split(' ');
	const searchString = args.slice(1).join(' ');
	
	const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
	const serverQueue = queue.get(msg.guild.id);

	let command = msg.content.toLowerCase().split(" ")[0];
	command = command.slice(prefix.length)

	if (command === `play`) {
		const voiceChannel = msg.member.voiceChannel;
		if (!voiceChannel) return msg.channel.send('**You must be in a voice channel :notes:.**');
		const permissions = voiceChannel.permissionsFor(msg.client.user);
		if (!permissions.has('CONNECT')) {
			
			return msg.channel.send('**ERROR: I Need `CONNECT` permission.**');
		}
		if (!permissions.has('SPEAK')) {
			return msg.channel.send('**Error: I need `SPEAK` permission.**');
		}

		if (!permissions.has('EMBED_LINKS')) {
			return msg.channel.sendMessage("*ERROR: I need `EMBED_LINKS` permission.**")
		}

		if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
			const playlist = await youtube.getPlaylist(url);
			const videos = await playlist.getVideos();
			
			for (const video of Object.values(videos)) {
				const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
				await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
			}
			return msg.channel.send('**Added to Queue: :notes: ' + `${playlist.title}` + ' .**');
		} else {
			try {

				var video = await youtube.getVideo(url);
			} catch (error) {
				try {
					var videos = await youtube.searchVideos(searchString, 10);
					let index = 0;
					const embed1 = new Discord.RichEmbed()
			        .setDescription(`**Please select the number of the video:**
${videos.map(video2 => `[**${++index} **] \`${video2.title}\``).join('\n')}`)

					.setFooter(message.author.tag)
					.setColor('RANDOM')
					msg.channel.sendEmbed(embed1).then(message =>{message.delete(20000)})
					
					try {
						var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
							maxMatches: 1,
							time: 60000,
							errors: ['time']
						});
					} catch (err) {
						console.error(err);
						return;
					}
					const videoIndex = parseInt(response.first().content);
					var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
				} catch (err) {
					console.error(err);
					return msg.channel.send(':sob: No result found.');
				}
			}

			return handleVideo(video, msg, voiceChannel);
		}
	} else if (command === `skip`) {
		if (!msg.member.voiceChannel) return msg.channel.send(`**You're not in a Voice Channel.**`);
		if (!serverQueue) return msg.channel.send('**There is not any songs in the queue.**');
		serverQueue.connection.dispatcher.end('Skipped.');
		return undefined;
	} else if (command === `stop`) {
		if (!msg.member.voiceChannel) return msg.channel.send("**You're not in a Voice Channel.**");
		if (!serverQueue) return msg.channel.send("**There's not song to stop.**");
		serverQueue.songs = [];
		serverQueue.connection.dispatcher.end('Stopped');
		return undefined;
	} else if (command === `vol`) {
		if (!msg.member.voiceChannel) return msg.channel.send("**You're not in a Voice Channel.**");
		if (!serverQueue) return;
		if (!args[1]) return msg.channel.send(':notes: Volume level: `' + `${serverQueue.volume}/100` + '`');
		serverQueue.volume = args[1];
		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 100);
		return msg.channel.send('**:speaker: Volume level has been changed to: **`' + `${args[1]}/100` + '`');
	} else if (command === `np`) {
		if (!serverQueue) return msg.channel.send('**Now Playing:** `Nothing..`');
		const embedNP = new Discord.RichEmbed()
	.setDescription(`**:notes: Now Playing: ${serverQueue.songs[0].title}**`)
		return msg.channel.sendEmbed(embedNP);
	} else if (command === `queue`) {
		if (!serverQueue) return msg.channel.send('**Now Playing:** `Nothing..`');
		let index = 0;
		const embedqu = new Discord.RichEmbed()
.setDescription(`**Songs Queue**
${serverQueue.songs.map(song => `**${++index} -** ${song.title}`).join('\n')}
**Now playing.. ** ${serverQueue.songs[0].title}`)
		return msg.channel.sendEmbed(embedqu);
	} else if (command === `pause`) {
		if (serverQueue && serverQueue.playing) {
			serverQueue.playing = false;
			serverQueue.connection.dispatcher.pause();
			return msg.channel.send('**:x: Song has been paused.**');
		}
		return msg.channel.send('**Now Playing:** `Nothing..`**');
	} else if (command === "resume") {
		if (serverQueue && !serverQueue.playing) {
			serverQueue.playing = true;
			serverQueue.connection.dispatcher.resume();
			return msg.channel.send('**:notes: Song has been resumed :fire: ..**');
		}
		return msg.channel.send(''**Now Playing:** `Nothing..`'*');
	}

	return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
	const serverQueue = queue.get(msg.guild.id);
	console.log(video);
	
//	console.log('yao: ' + Util.escapeMarkdown(video.thumbnailUrl));
	const song = {
		id: video.id,
		title: Util.escapeMarkdown(video.title),
		url: `https://www.youtube.com/watch?v=${video.id}`
	};
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: msg.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true
		};
		queue.set(msg.guild.id, queueConstruct);

		queueConstruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			play(msg.guild, queueConstruct.songs[0]);
		} catch (error) {
			console.error(`I could not join the voice channel: ${error}`);
			queue.delete(msg.guild.id);
			return msg.channel.send(`i can't join the room because: ${error}`);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		if (playlist) return undefined;
		else return msg.channel.send(`**Song has been added to queue list. : ${song.title}**`);
	}
	return undefined;
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	console.log(serverQueue.songs);

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', reason => {
			if (reason === 'Stream is not generating quickly enough.') console.log('Song ended.');
			else console.log(reason);
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on('error', error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

	serverQueue.textChannel.send('**Now Playing: ' + `${song.title}` + '**');
}

const devs = ['449313863494664214'];
client.on('message', message => {
  var argresult = message.content.split(` `).slice(1).join(' ');
    if (!devs.includes(message.author.id)) return;
    
if (message.content.startsWith(prefix + 'setGame')) {
  client.user.setGame(argresult);
    message.channel.sendMessage(`**${argresult} تم تغيير بلاينق البوت إلى **`)
} else 
  if (message.content.startsWith(prefix + 'setName')) {
client.user.setUsername(argresult).then
    message.channel.sendMessage(`**${argresult}** : تم تغيير أسم البوت إلى`)
return message.reply("**لا يمكنك تغيير الاسم يجب عليك الانتظآر لمدة ساعتين . **");
} else
  if (message.content.startsWith(prefix + 'setAvatar')) {
client.user.setAvatar(argresult);
  message.channel.sendMessage(`**${argresult}** : تم تغير صورة البوت`);
      } else     
if (message.content.startsWith(prefix + 'setStreaming')) {
  client.user.setGame(argresult, "https://www.twitch.tv/idk");
    message.channel.sendMessage(`**تم تغيير تويتش البوت إلى  ${argresult}**`)
}

});

client.on("message", message => {
 if (message.content === `${prefix}help`) {
  const embed = new Discord.RichEmbed() 
      .setColor('RANDOM')
      .setDescription(`
${prefix}play ⇏
${prefix}skip ⇏ 
${prefix}pause ⇏
${prefix}resume ⇏ 
${prefix}vol ⇏  
${prefix}stop ⇏ 
${prefix}np ⇏ 
${prefix}queue ⇏
 `)
   message.channel.sendEmbed(embed)
    
   }
   }); 
   
	client.login(process.env.TOKEN);

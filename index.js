const ffmpeg = require('fluent-ffmpeg');
const fs = require("fs");
const { getAudioDurationInSeconds } = require('get-audio-duration');

const episodeDir = "./podcast/episodes/"
const jsonDir = "./podcast/json/"
const outputDir = "./podcast/output/"
const midroll = "./podcast/ads/midroll.mp3"
let codec = "libmp3lame"
let container = "mp3"
let bitrate = 128;
let fileNames = {
	original: "original",
	preAdSpot: "pre",
	afterAdSpot: "after",
	output: "output",
	jsonName: "episode-"
}

function readDir() {
	fs.readdir(episodeDir, (err, episodeFolders) => {
		episodeFolders.forEach(episodeFolder => {
			let currentEpisode = episodeFolder
			let tempDir = episodeDir+episodeFolder
			let tempOutputDir = outputDir+episodeFolder
			fs.readdir(tempDir, (err, files) => {
				let tempObj = require(`${jsonDir}${fileNames.jsonName}${currentEpisode}.json`)

				// Episode was already cut. If you changed the Time on which the
				// ad spot should appear, you have to delete the pre.mp3 and after.mp3
				// files. Keep in mind that the process will take longer.
				if(files.includes(`${fileNames.preAdSpot}.${container}`) && files.includes(`${fileNames.afterAdSpot}.${container}`)){
					addMidroll(tempDir, tempOutputDir).then(() => {
						updateJsonFile(currentEpisode)
					}, (err) => console.error(err))
				}

				// The episode was not cut already.
				else{
					preMidroll(tempObj.midroll, tempDir).then(() => {
						postMidroll(tempObj.midroll, tempDir).then(() => {
							addMidroll(tempDir, tempOutputDir).then(() => {
								updateJsonFile(currentEpisode)
							}, (err) => console.error(err))
						}, (err) => console.error(err))
					}, (err) => console.error(err))
				}
			});
		});
	});
}
const preMidroll = (cutTime, directory) => {
	return new Promise((resolve, reject) => {
		ffmpeg(`${directory}/${fileNames.original}.${container}`)
			.duration(cutTime)
			.output(`${directory}/${fileNames.preAdSpot}.${container}`)
			.on('error', function(err) {
				reject(err.message);
			})
			.on('end', function() {
				resolve();
			})
			.run();
	});
}
const postMidroll = (cutTime, directory) => {
	return new Promise((resolve, reject) => {
		ffmpeg(`${directory}/${fileNames.original}.${container}`)
			.seekInput(cutTime)
			.output(`${directory}/${fileNames.afterAdSpot}.${container}`)
			.on('error', function(err) {
				reject(err.message);
			})
			.on('end', function() {
				resolve();
			})
			.run();
	})
}

const addMidroll = (path, outputDir) => {
	if (!fs.existsSync(outputDir)){
		fs.mkdirSync(outputDir);
	}

	return new Promise((resolve, reject) => {
		ffmpeg(`${path}./${fileNames.preAdSpot}.${container}`)
			.input(midroll)
			.input(`${path}./${fileNames.afterAdSpot}.${container}`)
			.audioCodec(codec)
			.audioBitrate(bitrate)
			.on('error', function(err) {
				reject(err.message);
			})
			.on('end', function() {
				resolve();
			})
			.mergeToFile(`${outputDir}/${fileNames.output}.${container}`);
	})
}

function updateJsonFile(episode){
	const jsonFileDir = `${jsonDir}${fileNames.jsonName}${episode}.json`
	const audioDir = `${episodeDir}${episode}/${fileNames.output}.${container}`;
	let tempObj = require(jsonFileDir)

	let newBitLength = fs.statSync(audioDir).size
	tempObj.bitlength = newBitLength
	getAudioDurationInSeconds(audioDir).then((duration) => {
		console.log(duration)
		let minutes = Math.floor(duration/60)
		let seconds = Math.ceil(duration-(minutes*60))
		tempObj.duration = `${minutes}:${seconds}`
		console.log(tempObj)
		storeData(tempObj, jsonFileDir);
	});
}

const storeData = (data, path) => {
	try {
	  fs.writeFileSync(path, JSON.stringify(data))
	} catch (err) {
	  console.error(err)
	}
  }

readDir();
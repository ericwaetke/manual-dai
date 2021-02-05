const ffmpeg = require('fluent-ffmpeg');
const fs = require("fs");
const { getAudioDurationInSeconds } = require('get-audio-duration');
const { resolve } = require('path');

let crossfadeDuration = 3;
let codec = "libmp3lame"
let inputContainer = "flac"
let outputContainer = "mp3"
let bitrate = 128;
let fileNames = {
	original: "original",
	preAdSpot: "pre",
	afterAdSpot: "after",
	output: "output",
	jsonName: "episode-"
}

const episodeDir = "./podcast/episodes/"
const jsonDir = "./podcast/json/"
const outputDir = "./podcast/output/"
const intro = `./podcast/ads/intro.${inputContainer}`
const midroll = `./podcast/ads/midroll.${inputContainer}`
const outro = `./podcast/ads/outro.${inputContainer}`

// TEMP VARIABLES
const appendIntro = false;
const appendMidroll = true;
const appendOutro = false;

function readDir() {
	fs.readdir(episodeDir, (err, episodeFolders) => {
		episodeFolders.forEach(episodeFolder => {
			let currentEpisode = episodeFolder
			let tempDir = episodeDir+episodeFolder
			let tempOutputDir = outputDir+episodeFolder
			fs.readdir(tempDir, (err, files) => {
				//Only execute the code, if there is an original file
				if(files.includes(`${fileNames.original}.${inputContainer}`)){
					let tempObj = require(`${jsonDir}${fileNames.jsonName}${currentEpisode}.json`)

					// Episode was already cut. If you changed the Time on which the
					// ad spot should appear, you have to delete the pre.mp3 and after.mp3
					// files. Keep in mind that the process will take longer.
					if(files.includes(`${fileNames.preAdSpot}.${inputContainer}`) && files.includes(`${fileNames.afterAdSpot}.${inputContainer}`)){
						exportAudio(currentEpisode).then(() => {
							updateJsonFile(currentEpisode)
						}, (err) => console.error(err))
	
					}
	
					// The episode was not cut already.
					else{
						cutAudio(tempObj.midroll, tempDir).then(() => {
							exportAudio(currentEpisode).then(() => {
								updateJsonFile(currentEpisode)
							}, (err) => console.error(err))
						}, (err) => console.error(err))
					}
				}
			});
		});
	});
}
const cutAudio = (cutTime, directory) => {
	return new Promise((resolve, reject) => {
		preMidroll(cutTime, directory).then(() => {
			postMidroll(cutTime, directory).then(() => {
				resolve()
			})
		})
	})
}

const preMidroll = (cutTime, directory) => {
	// let fadeStart = `${cutTime.split(":")[0]}:${parseInt(cutTime.split(":")[1].split(".")[0]) - 1}.${cutTime.split(":")[1].split(".")[1]}`

	return new Promise((resolve, reject) => {
		ffmpeg(`${directory}/${fileNames.original}.${inputContainer}`)
			.duration(cutTime)
			.output(`${directory}/${fileNames.preAdSpot}.${inputContainer}`)
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
		ffmpeg(`${directory}/${fileNames.original}.${inputContainer}`)
			.seekInput(cutTime)
			.output(`${directory}/${fileNames.afterAdSpot}.${inputContainer}`)
			.on('error', function(err) {
				reject(err.message);
			})
			.on('end', function() {
				resolve();
			})
			.run();
	})
}

const exportAudio = (episode) => {
	return new Promise((resolve, reject) => {
		// Creating the episode dir in the output folder, if it doesn't exist already
		const episodeOutputDir = `${outputDir}/${episode}/`
		if (!fs.existsSync(episodeOutputDir)){
			fs.mkdirSync(episodeOutputDir);
		}
		// Creating the Temp Dir if it doesn't exist already
		const tempDir = `${outputDir}/temp/`;
		if (!fs.existsSync(tempDir)){
			fs.mkdirSync(tempDir);
		}

		let tempFileDir = `${outputDir}/temp/${episode}.${inputContainer}`

		//Copy current episode into the temp folder
		fs.copyFile(`${episodeDir}/${episode}/${fileNames.original}.${inputContainer}`, tempFileDir, (err, data) => {
			if(err) console.error(err)
		})
		
		addMidroll(episode).then(() => {
			addIntro(episode).then(() => {
				addOutro(episode).then(() => {
					convertion(episode).then(() => {
						resolve();
					})
				})
			})
		})
	})
}

const addMidroll = (episode) => {
	console.log("adding midroll");
	let input = `${outputDir}/temp/${episode}.${inputContainer}`

	return new Promise((resolve, reject) => {
		if(appendMidroll){
			ffmpeg()
				// Starting out with the Pre-Mid Roll Sequence
				.input(`${episodeDir}${episode}/${fileNames.preAdSpot}.${inputContainer}`)
				// Adding the Midroll element
				.input(midroll)
				//  Adding the After Midroll Element as third Input
				.input(`${episodeDir}${episode}/${fileNames.afterAdSpot}.${inputContainer}`)
				.on('error', function(err) {
					reject(err.message);
				})
				.on('end', function() {
					resolve();
				})
				.mergeToFile(input);
		} else{
			resolve()
		}
	})
}

const addIntro = (episode) => {
	let input = `${outputDir}/temp/${episode}.${inputContainer}`
	let tempOutput = `${outputDir}/temp/${episode}-temp.${inputContainer}`

	return new Promise((resolve, reject) => {
		if(appendIntro){
			ffmpeg()
				// Starting with the Intro
				.input(intro)
				// Appending the Temp Episode
				.input(input)
				.on('error', function(err) {
					reject(err.message);
				})
				.on('end', function() {
					fs.unlinkSync(input)
					fs.rename(tempOutput, input)
					resolve();
				})
				.mergeToFile(tempOutput);
		} else{
			resolve()
		}
	})
}

const addOutro = (episode) => {
	let input = `${outputDir}/temp/${episode}.${inputContainer}`
	let tempOutput = `${outputDir}/temp/${episode}-temp.${inputContainer}`

	return new Promise((resolve, reject) => {
		if(appendOutro){
			ffmpeg()
				// Starting with the Temp Original
				.input(input)
				// Appending the Outro
				.input(outro)
				.on('error', function(err) {
					reject(err.message);
				})
				.on('end', function() {
					fs.unlinkSync(input)
					fs.rename(tempOutput, input)
					resolve();
				})
				.mergeToFile(tempOutput);
		} else{
			resolve()
		}
	})
}

const convertion = (episode) => {
	let input = `${outputDir}/temp/${episode}.${inputContainer}`

	return new Promise((resolve, reject) => {
		ffmpeg()
			// Starting with the Temp Original
			.input(input)
			.on('error', function(err) {
				reject(err.message);
			})
			.on('end', function() {
				resolve();
			})
			.output(`${outputDir}${episode}/${fileNames.output}.${outputContainer}`)
			.run()
	})
}

// const addMidroll = (path, outputDir) => {
	
// 	return new Promise((resolve, reject) => {
// 		ffmpeg()
// 			// Starting out with the Pre-Mid Roll Sequence
// 			.input(`${path}./${fileNames.preAdSpot}.${inputContainer}`)
// 			// Adding the Midroll element
// 			.input(midroll)
// 			//  Adding the After Midroll Element as third Input
// 			.input(`${path}./${fileNames.afterAdSpot}.${inputContainer}`)
// 			.audioCodec(codec)
// 			.audioBitrate(bitrate)

// 			//Adding a crossfade between the elements
// 			// .complexFilter([
// 			// 	{
// 			// 		filter: "acrossfade", options: {
// 			// 			c1: "tri",
// 			// 			c2: "tri"
// 			// 		}
// 			// 	}
// 			// 	// `[0][1]acrossfade=d=10:c1=tri:c2=tri[a01]`,
// 			// 	// `[a01][2]acrossfade=d=${crossfadeDuration}:c1=tri:c2=tri[a02]`
// 			// ])
// 			.on('error', function(err) {
// 				reject(err.message);
// 			})
// 			.on('end', function() {
// 				resolve();
// 			})
// 			.mergeToFile(`${outputDir}/${fileNames.output}.${outputContainer}`,`${outputDir}/temp/`);
// 	})
// }

function updateJsonFile(episode){
	const jsonFileDir = `${jsonDir}${fileNames.jsonName}${episode}.json`
	const audioDir = `${outputDir}${episode}/${fileNames.output}.${outputContainer}`;
	let tempObj = require(jsonFileDir)

	console.log(audioDir)

	let newBitLength = fs.statSync(audioDir).size
	tempObj.bitlength = newBitLength
	// getAudioDurationInSeconds(audioDir).then((duration) => {
	// 	let minutes = Math.floor(duration/60)
	// 	let seconds = Math.ceil(duration-(minutes*60))
	// 	tempObj.duration = `${minutes}:${seconds}`
	// 	console.log(`Duration: ${duration} - ${minutes}:${seconds}`)
	// 	storeData(tempObj, jsonFileDir);
	// });

	ffmpeg.ffprobe(audioDir, function(err, metadata) {
		console.dir(metadata); // all metadata
		console.log(metadata.format.duration);
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
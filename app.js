const http = require('http');
const express = require('express');
const app = express();
const fs = require('fs');
const bodyParser = require('body-parser');
const pug = require('pug');
const crypto = require('crypto')

const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

var host = pug.compileFile('host.pug')

const urlencodedParser = bodyParser.urlencoded({ extended: false })

const port = process.env.PORT || 3001;

const username = ''; //'test';
const password = ''; //'test';

app.use(express.static('./'))
app.set('view engine', 'pug');
app.set('views', './');

//TODO create a dict of passwords=>{creationtime, socket}
// every time a new room is created, if the socket is over x time,
// delete it or something
// or can i just remove the sockets whenever? idk

app.get('/', urlencodedParser, function (req, res) {
	// res.sendFile(__dirname + '/home.html');
	res.render('home');
});

app.post('/contestant', urlencodedParser, function (req, res) {
	res.render('contestant');
});


app.post('/host', urlencodedParser, function (req, res) {
	if (req.body.username != username || req.body.password != password) {
		return;
	}
	res.render('host', { categories: allCategories });
});




// GAME MANAGEMENT
var allQuestions = JSON.parse(fs.readFileSync('./questions.json'));
var allCategories = Object.keys(allQuestions);
var sampleIndex = allCategories.indexOf('sample');
if (sampleIndex > -1) {
	allCategories.splice(sampleIndex, 1);
}
var shinyIndex = allCategories.indexOf('shiny');
if (shinyIndex > -1) {
	allCategories.splice(shinyIndex, 1);
}
var rooms = {};
/*
room = {
roomname: {
	categories: [pokemon, wubby lore] // category names, used for choosing questions
	contestants: { // player names, used for scoring
		sockeid: {
			name: username
			score: 34
		}
	}
	questions: { // all questions, sorted by percieved difficulty
		sample: []
		easy: []
		medium: []
		hard: []
		shiny: []
	}
	buzz: { // when users buzz in, used for determining who goes first when answering
		username1: timestamp
		username2: timestamp
	}
},...
}
*/

//TODO create rooms, have the password be sent with each message to make sure things
// are happening for the correct room
// make sure buzzers are reset for the correct room

function init(data) {
	if (!(data.room in rooms)) return;
	console.log("initialising room " + data.room);
	// set categories
	rooms[data.room].categories = data.categories;
	
	// add questions
	for (const [category, value] of Object.entries(allQuestions)) {
		// add all sample questions
		if (category == 'sample') {
			for (var i=0; i<value.length; i++) {
				rooms[data.room].questions[category].push(value[i]);
			}
			continue;
		}
		if (category == 'shiny') {
			for (const [title, question] of Object.entries(value)) {
				rooms[data.room].questions[category][title] = question;
			}
		}

		// add questions from selected categories
		if (rooms[data.room].categories.includes(category)) {
			for (const [difficulty, questions] of Object.entries(value)) {
				for (var i=0; i<questions.length; i++) {
					rooms[data.room].questions[difficulty].push(questions[i]);
				}
			}
		}
	}
}

function createRoom(data) {
	console.log('creating room ' + data.room)
	if (data.room in rooms) {
		//TODO delete the room or something idk
		console.log('NUKE IT ALL')
	}
	rooms[data.room] = {
		timestamp: Date.now(),
		categories: [],
		contestants: {},
		questions: {
			sample: [],
			easy: [],
			medium: [],
			hard: [],
			shiny: []
		},
		buzz: {}
	};
}

function buzz(data) {
	if (!(data.room in rooms)) return;
	if (!(data.who in rooms[data.room].contestants)) return;
	// var who = rooms[data.room].contestants[data.who].name
	var who = data.who
	if (!(who in rooms[data.room].buzz)) {
		// rooms[data.room].buzz[who] = data.when;
		rooms[data.room].buzz[who] = {
			who: rooms[data.room].contestants[who].name,
			when: data.when
		}
	}
	//TODO pause for latency
	io.to(data.room).emit('buzz', rooms[data.room].buzz)
}

function resetBuzzers(data) {
	rooms[data.room].buzz = {};
	io.in(data.room).emit('reset buzzers');
}

function updateScores(data) {
	if (!(data.room in rooms)) return;
	for (const [key, value] of Object.entries(data.scores)) {
		if (!(key in rooms[data.room].contestants)) continue;
		rooms[data.room].contestants[key].score = value;
	}
	io.in(data.room).emit('update scores', {scores: rooms[data.room].contestants});
}

function question(data) {
	if (!(data.room in rooms)) return;

	// select question
	var q = null;
	if (rooms[data.room].questions[data.difficulty].length <= 0) {
		q = {error: 'No ' + data.difficulty + ' questions are left.'}
	} else if (data.difficulty == 'sample') {
		q = rooms[data.room].questions[data.difficulty][0]; //TODO have more sample qs
	} else {
		var qIndex = Math.floor(Math.random() * rooms[data.room].questions[data.difficulty].length)
		if (data.help != '') {
			var origQIndex = qIndex;
			while (!rooms[data.room].questions[data.difficulty][qIndex].category == data.help) {
				qIndex = (qIndex + 1) % rooms[data.room].questions[data.difficulty].length;
				if (qIndex == origQIndex) {
					q = {error: 'No ' + data.difficulty + ' questions that help ' + data.help + ' are left.'};
					break;
				}
			}
		}
		if (q == null) {
			q = rooms[data.room].questions[data.difficulty].splice(qIndex, 1)[0];
		}
	}

	console.log("emitting question to room " + data.room)
	io.to(data.room).emit('question', q)
}

function endGame(data) {
	if (!(data.room in rooms)) return;
	if (Object.keys(rooms[data.room].contestants).length <= 0) {
		return;
	}
	var winner = Object.keys(rooms[data.room].contestants).reduce(function(a,b){
		return rooms[data.room].contestants[a].score > rooms[data.room].contestants[b].score ? a : b;
	});
	io.to(data.room).emit('end game', { id: winner, winner: rooms[data.room].contestants[winner].name });
}

function shinyGames(data) {
	if (!(data.room in rooms)) return;
	var titles = {};
	for (const [title, question] of Object.entries(rooms[data.room].questions.shiny)) {
		titles[title] = { description: question.description };
	}
	io.to(data.room).emit('shiny games', {titles: titles});
}

function shinyQuestion(data) {
	if (!(data.room in rooms)) return;
	io.to(data.room).emit('shiny question', {title: data.name, data: rooms[data.room].questions.shiny[data.name]})
}

function revealShiny(data) {
	if (!(data.room in rooms)) return;
	io.to(data.room).emit('reveal shiny');
}
//TODO remove shiny when done?

// SOCKET STUFF
io.on('connection', (socket) => {
	socket.on('question', question);
	socket.on('init', init);
	socket.on('buzz', buzz);
	socket.on('reset buzzers', resetBuzzers);
	socket.on('update scores', updateScores);
	socket.on('end game', endGame);
	socket.on('shiny games', shinyGames);
	socket.on('shiny question', shinyQuestion);
	socket.on('reveal shiny', revealShiny);


	socket.on('create room', function(data) {
		//TODO create room object, include timestamp of when it was created
		//TODO if room exists, check timestamp. If it's older than a few hours or something, kill it
		socket.join(data.room);
		createRoom(data);
		console.log('creating & joining room ' + data.room);
	});
	socket.on('join room', function(data) {
		//TODO if room name doesnt exist, respond with error
		if (!(data.room in rooms)) return;
		rooms[data.room].contestants[socket.id] = {
			name: data.name,
			score: 0
		};
		socket.join(data.room);
		console.log(data.name + ' (' + socket.id + ') is joining room ' + data.room);
		io.to(data.room).emit('contestant joined', { id: socket.id, name: data.name });
		io.to(data.room).emit('update scores', {scores: rooms[data.room].contestants});
	});
});





server.listen(port, () => {
	console.log('listening on *:3000');
});
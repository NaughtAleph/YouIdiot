var socket = null;
var room;
var contestants = {};

function createSocket() {
	var password = document.getElementById('password');
	if (password.value == '') {
		password.placeholder = 'Please enter a password';
		return
	}
	room = password.value;
	if (socket == null) socket = io();
	socket.on('connect', () => {
		console.log('(re)connected')

		// This will always create the room, even if the server restarts, since
		// 'connect' event fires on reconnection as well
		socket.emit('create room', { room: room }, (res) => {
			if ("error" in res) {
				console.log(res);
			} else {
				console.log("success");
			}
		});
		socket.on('question', displayQuestion)
		socket.on('buzz', updateBuzz);
		socket.on('contestant joined', addContestant);
		socket.on('end game', endGame);
		socket.on('shiny games', shinyGames);
		socket.on('shiny question', handleShiny);
	});
	var roomTAG = document.getElementById('room');
	roomTAG.setAttribute('class', 'room');
	roomTAG.innerHTML = 'Room name: <span class="copy">' + password.value + '</span>';
	document.getElementById('setup').hidden = false;
}

function beginGame() {
	if (socket == null) {
		return
	}
	var categoriesTAG = document.querySelectorAll('input[type=checkbox]:checked');
	var categories = [];
	var helpTAG = document.getElementById('category');
	for (var i=0; i<categoriesTAG.length; i++) {
		categories.push(categoriesTAG[i].value);
		var node = document.createElement('option');
		node.value = categoriesTAG[i].value;
		node.innerHTML = categoriesTAG[i].value;
		helpTAG.appendChild(node);
	}

	socket.emit('init', {
		room: room,
		categories: categories
	});

	document.getElementById('setup').hidden = true;
	document.getElementById('intro').open = false;
	document.getElementById('rules').open = false;
	document.getElementById('game').hidden = false;
}

function question(difficulty) {
	resetBuzzers();
	socket.emit('question', {
		room: room,
		difficulty: difficulty,
		help: document.getElementById('category').value
	});
	document.getElementById('category').value = '';
	
}

function displayQuestion(data) {
	document.getElementById('shiny-description').hidden = true;
	document.getElementById('question').innerHTML = '';
	document.getElementById('answer').innerHTML = '';
	document.getElementById('explain').innerHTML = '';
	if (data != null && data.constructor == Object) {
		if ('error' in data) {
			document.getElementById('question').innerHTML = data.error;
		} else if ('shiny' in data) {
			handleShiny(data);
		} else if( 'question' in data && 'answer' in data && 'explain' in data) {
			if (data.shiny) {
				//TODO
				document.getElementById('question').innerHTML = 'shiny!!!';
			} else {
				document.getElementById('question').innerHTML = data.question;
				document.getElementById('answer').innerHTML = data.answer;
				document.getElementById('explain').innerHTML = data.explain;
			}
		} else {
			document.getElementById('question').innerHTML = 'error. uh oh'
		}
	} else {
		document.getElementById('question').innerHTML = 'error. uh oh'
	}
}

function handleShiny(data) {
	console.log(data)
}

function updateBuzz(data) {
	var list = Object.keys(data).sort(function (a,b) { return data[a].when - data[b].when; });
	var order = document.getElementById('buzzOrder');
	order.innerHTML = '';
	if (list.length > 0) {
		var node = document.createElement('li')
		var first = data[list[0]].when;
		node.append(data[list[0]].who);
		order.appendChild(node);
		for (var i=1; i<list.length; i++) {
			var node = document.createElement('li')
			node.append(data[list[i]].who + ' (+' + ((data[list[i]].when - first)/1000) + 's)');
			order.appendChild(node);
		}
	}
}

function resetBuzzers() {
	document.getElementById('buzzOrder').innerHTML = '';
	socket.emit('reset buzzers', { room: room });
}

function addContestant(data) {
	contestants[data.id] = {
		name: data.name,
		score: 0
	}
	var node = document.createElement('li');
	node.append(data.name);
	document.getElementById('contestants').appendChild(node);

	updateScores();
}

function updateScores() {
	var scores = document.getElementById('scores');
	scores.innerHTML = '<div class="col-12 section-title">Scores</div>';
	for (const [key, val] of Object.entries(contestants)) {
		// var element = document.createElement('div');
		// element.setAttribute('id', key);
		// element.innerHTML = val.name + ': <input type="number" class="form-control score" value=' + val.score + ' onchange="changeScore()">';
		// scores.appendChild(element);

		var element = document.createElement('div');
		element.setAttribute('class', 'col-4 score-col');
		element.innerHTML =
			`<div class="score-name">
				${val.name}
			</div>
			<div class="score-changer d-inline-flex">
				<button class="btn btn-secondary input-group-text m-0 btn-decrement" onclick="this.parentNode.querySelector('input[type=number]').stepDown(); changeScore()"><i class="fa-solid fa-minus"></i></button>
				<input id=${key} type="number" class="form-control score-input" value=${val.score} onchange="changeScore()">
				<button class="btn btn-secondary input-group-text m-0 btn-increment" onclick="this.parentNode.querySelector('input[type=number]').stepUp(); changeScore()"><i class="fa-solid fa-plus"></i></button>
			</div>`
		scores.appendChild(element);
	}
	changeScore();
}

function changeScore() {
	var scoresTAGs = document.getElementsByClassName('score-input');
	var scores = {};

	// compile current scores
	for (let scoreTAG of scoresTAGs) {
		scores[scoreTAG.id] = scoreTAG.value;
		contestants[scoreTAG.id].score = scoreTAG.value;
	}

	// send to the server
	socket.emit('update scores', { room: room, scores: scores });
}

function emitEndGame() {
	socket.emit('end game', { room: room });
}

function endGame(data) {
	document.getElementById('winner').innerHTML = data.winner + ' wins!';
	document.getElementById('game').hidden = true;
	document.getElementById('winner-section').hidden = false;
}

function getShinyGames() {
	socket.emit('shiny games', { room: room });
}

var shinies = {}

function shinyGames(data) {
	shinies = data.titles;
	var shinyPicker = document.getElementById('shiny-picker');
	shinyPicker.innerHTML = '';
	shinyPicker.hidden = false;
	// for (var i=0; i<data.titles.length; i++) {
	for (const title in data.titles) {
		var element = document.createElement('button');
		element.setAttribute('class', 'btn btn-secondary');
		element.setAttribute('onclick', 'describeShiny("' + title + '")');
		element.innerHTML = title;
		shinyPicker.appendChild(element);
	}
}

function describeShiny(title) {
	var shinyDesc = document.getElementById('shiny-description');
	shinyDesc.innerHTML = `
		<div>${shinies[title].description}</div>
		<button class='btn btn-secondary' id='begin-shiny' onclick='getShiny("${title}")'>Begin</button>`;
	shinyDesc.hidden = false;
	document.getElementById('begin-shiny').hidden = false;

	console.log(shinies)
}

function getShiny(name) {
	socket.emit('shiny question', { room: room, name: name});
}

function handleShiny(data) {
	document.getElementById('shiny-picker').hidden = true;
	// document.getElementById('shiny-description').hidden = true;
	document.getElementById('begin-shiny').hidden = true;
	// handle different shiny question types
	switch(data.title) {
	case 'Can I Fuck It?':
		// Question
		var questionTAG = document.getElementById('question');
		var str = '<div class="row">';
		for (var i=0; i<data.data.images.length; i++) {
			str += `<div class='col-4 p-1'><div>${data.data.images[i].name}</div><img src='${data.data.images[i].src}' width='100%'/></div>`
		}
		questionTAG.innerHTML = str + '</div>';

		// Correction
		var correctionTAG = document.getElementById('answer');
		correctionTAG.innerHTML = `
			<div class='row'>
				<div class='col-4'><div class='wrong'>FAKE: ${data.data.fake.name}</div><img src='${data.data.fake.src}' width='100%' /></div>
				<div class='col-4'><div class='real'>REAL: ${data.data.real.name}</div><img src='${data.data.real.src}' width='100%' /></div>
			</div>
			<div class='btn btn-secondary' onclick='revealShiny()'>Reveal Answer</div>`;

		// Explanation
		var str = '<ol>';
		for (var i=0; i<data.data.explain.length; i++) {
			str += `<li>${data.data.explain[i]}</li>`
		}
		document.getElementById('explain').innerHTML = str + '</ol>'
		break;
	case "What is wrong with this picture?":
		// Question
		document.getElementById('question').innerHTML = `<div class='text-center'><img src="${data.data.wrong}" width="50%" /></div>`
		
		// Correction
		document.getElementById('answer').innerHTML = `
			<div class='text-center'><img src="${data.data.real}" width="50%" /></div>
			<div><button class="btn btn-secondary" onclick="revealShiny()">Reveal Answer</button></div>`
		
		// Explanation
		document.getElementById('explain').innerHTML = data.data.explain;
	default:
		//TODO
		console.log('error');
		break;
	}
}

function revealShiny() {
	socket.emit('reveal shiny', {room: room})
}
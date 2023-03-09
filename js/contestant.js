var socket = null;
var password;

function joinRoom() {
	var name = document.getElementById('name');
	password = document.getElementById('password');
	if (name.value == '') {
		name.placeholder = 'Please enter a name';
		return;
	}
	if (password.value == '') {
		password.placeholder = 'Please enter a room';
		return
	}
	if (socket == null) socket = io();
	socket.on('connect', () => {
		console.log('(re)connected')

		// This will always create the room, even if the server restarts, since
		// 'connect' event fires on reconnection as well
		socket.emit('join room', { room: password.value, name: document.getElementById('name').value }, (res) => {
			if ("error" in res) {
				console.log(res);
			} else {
				console.log("success");
			}
		});
		socket.on('question', displayQuestion);
		socket.on('buzz', buzzCallback);
		socket.on('reset buzzers', resetBuzzer);
		socket.on('update scores', updateScores);
		socket.on('end game', endGame);
		socket.on('shiny question', handleShiny);
		socket.on('reveal shiny', revealShiny);
	});
	document.getElementById('title').innerHTML = name.value;
	document.getElementById('setup').hidden = true;
	document.getElementById('game').hidden = false;
}

function displayQuestion(data) {
	if ('error' in data) {
		return;
	}
	var q = document.getElementById('question')
	q.innerHTML = data.question;
	q.hidden = false;
}

function buzz() {
	var who = socket.id;
	socket.emit('buzz', {room: password.value, who: who, when: Date.now()});
}

function buzzCallback(data) {
	var list = Object.keys(data).sort(function (a,b) { return data[a] - data[b]; });
	// document.getElementById('question').hidden = true;
	// var me = document.getElementById('title').innerHTML;
	var me = socket.id;
	if (list[0] == me) {
		// background = green
		document.getElementById('buzzer').setAttribute('class', 'btn btn-lg btn-success w-100');
	} else if (list.includes(me)) {
		// background = orange
		document.getElementById('buzzer').setAttribute('class', 'btn btn-lg btn-danger w-100');
	}
	if (list[0] == me) {
		document.getElementById('answerer').innerHTML = 'You buzzed first!'
	} else {
		document.getElementById('answerer').innerHTML = data[list[0]].who + ' buzzed first';
	}

}

function resetBuzzer() {
	document.getElementById('answerer').innerHTML = '';
	document.getElementById('buzzer').setAttribute('class', 'btn btn-lg btn-warning w-100');
}

function updateScores(data) {
	var scoresTAG = document.getElementById('scores');
	scoresTAG.innerHTML = '<div class="col-12 section-title">Score</div>';
	for (const [key, val] of Object.entries(data.scores)) {
		var node = document.createElement('div');
		node.setAttribute('class', 'col-12 score');
		node.innerHTML = val.name + ': ' + val.score;
		scoresTAG.appendChild(node);
	}
}

function endGame(data) {
	document.getElementById('game').hidden = true;
	document.getElementById('winner-section').hidden = false;
	var text;
	if (data.id == socket.id) {
		text = 'You won, ' + data.winner + '!';
		startConfetti();
	} else {
		text = data.winner + ' won';
	}
	document.getElementById('winner').innerHTML = text;
}

var shiny = {};

function handleShiny(data) {
	shiny = data;
	switch(data.title) {
	case "Can I Fuck It?":
		var questionTAG = document.getElementById('question');
		var str = '<div class="row">';
		for (var i=0; i<data.data.images.length; i++) {
			str += `<div class='col-4 p-1'><div>${data.data.images[i].name}</div><img src='${data.data.images[i].src}' width='100%'/></div>`
		}
		questionTAG.innerHTML = str + '</div>';
		break;
	case "What is wrong with this picture?":
		document.getElementById('question').innerHTML = `<div class='text-center'><img src="${data.data.wrong}" width="50%" /></div>`
		break;
	default:
		console.log('error');
		break;
	}
}

function revealShiny(data) {
	switch(shiny.title) {
	case "Can I Fuck It?":
		var questionTAG = document.getElementById('question');
		questionTAG.innerHTML += `
			<div class='row justify-content-center'>
				<div class='col-4'><div class='wrong'>WRONG: ${shiny.data.fake.name}</div><img src="${shiny.data.fake.src}" width='100%' /></div>
				<div class='col-4'><div class='real'>REAL: ${shiny.data.real.name}</div><img src="${shiny.data.real.src}" width='100%' /></div>
			</div>`
		break;
	case "What is wrong with this picture?":
		document.getElementById('question').innerHTML += `
			<div class='text-center'><img src="${shiny.data.real}" width='50%'/></div>`
	default:
		console.log('error');
		break;
	}
}
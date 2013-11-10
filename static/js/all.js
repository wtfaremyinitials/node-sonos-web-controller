"use strict";
var currentState = {
	selectedZone: null,
	zoneInfo: null,
	masterVolume: 0,
	setMasterVolume: function (volume) {

	},
};

var grouping = {};
var players = {};
var positionInterval;

///
/// GUI Init
///

var GUI = {
	masterVolume: volumeSlider(document.getElementById('master-volume'), function (volume) {
			socket.emit('group-volume', {uuid: currentState.selectedZone, volume: volume});
		})
};

///
/// socket events
///
socket.on('topology-change', function (data) {
	grouping = {};
	var stateTime = new Date().valueOf();
	data.forEach(function (player) {
		player.stateTime = stateTime;
    	players[player.uuid] = player;
    	if (!grouping[player.coordinator]) grouping[player.coordinator] = [];
    	grouping[player.coordinator].push(player.uuid);

    	// pre select a group
    	if (!currentState.selectedZone) {
    		currentState.selectedZone = player.coordinator;
    	}
    });

    console.log(grouping, players);

    reRenderZones();
    updateControllerState();
	updateCurrentStatus();
});

socket.on('transport-state', function (player) {
    console.log(player);
    player.stateTime = new Date().valueOf();
    players[player.uuid] = player;
    reRenderZones();
    var selectedZone = players[currentState.selectedZone];
	console.log(selectedZone)
 	updateControllerState();
	updateCurrentStatus();

});

///
/// GUI events
///

document.getElementById('zone-container').addEventListener('click', function (e) {
	// Find the actual UL
	function findZoneNode(currentNode) {
		// If we are at top level, abort.
		if (currentNode == this) return;
		if (currentNode.tagName == "UL") return currentNode;
		return findZoneNode(currentNode.parentNode);
	}

	var zone = findZoneNode(e.target);

	if (!zone) return;

	document.getElementById(currentState.selectedZone).classList.remove('selected');

	currentState.selectedZone = zone.id;	
	zone.classList.add('selected');
	// Update controls with status

	updateControllerState();
	updateCurrentStatus();



}, true);

document.getElementById('play-pause').addEventListener('click', function () {

	var action;
	// Find state of current player
	var player = players[currentState.selectedZone];
	if (player.state.zoneState == "PLAYING" ) {
		action = 'pause';
	} else {
		action = 'play';
	}

	console.log(action, currentState)
	socket.emit('transport-state', { uuid: currentState.selectedZone, state: action });
});

document.getElementById('next').addEventListener('click', function () {
	var action = "nextTrack";
	console.log(action, currentState)
	socket.emit('transport-state', { uuid: currentState.selectedZone, state: action });
});
document.getElementById('prev').addEventListener('click', function () {
	var action = "previousTrack";
	console.log(action, currentState)
	socket.emit('transport-state', { uuid: currentState.selectedZone, state: action });
});

// For chrome
document.getElementById('master-volume').addEventListener("mousewheel", handleVolumeWheel);

// For Firefox
document.getElementById('master-volume').addEventListener("wheel", handleVolumeWheel);

///
/// Functions
///

function handleVolumeWheel(e) {
	var direction = e.deltaY > 0 ? "down" : "up";
	console.log(direction)
}

function updateCurrentStatus() {
	var selectedZone = players[currentState.selectedZone];
	console.log("updating current", selectedZone)
	document.getElementById("track").textContent = selectedZone.state.currentTrack.title;
	document.getElementById("artist").textContent = selectedZone.state.currentTrack.artist;
	document.getElementById("album").textContent = selectedZone.state.currentTrack.album;

	if (selectedZone.state.nextTrack) {
		var nextTrack = selectedZone.state.nextTrack;
		document.getElementById("next-track").textContent = nextTrack.title + " - " + nextTrack.artist;
	}

	console.log(selectedZone)

	var repeat = document.getElementById("repeat");
	if (selectedZone.playMode == 1 || selectedZone.playMode == 3) {
		repeat.src = repeat.src.replace("off", "on");
	} else {
		repeat.src = repeat.src.replace("on", "off");
	}

	var shuffle = document.getElementById("shuffle");
	if (selectedZone.playMode == 2 || selectedZone.playMode == 3) {
		shuffle.src = shuffle.src.replace("off", "on");
	} else {
		shuffle.src = shuffle.src.replace("on", "off");
	}

	var crossfade = document.getElementById("crossfade");
	if (selectedZone.crossfade == "1") {
		crossfade.src = crossfade.src.replace("off", "on");
	} else {
		crossfade.src = crossfade.src.replace("on", "off");
	}


	clearInterval(positionInterval);
	
	if (selectedZone.state.zoneState == "PLAYING")
		positionInterval = setInterval(updatePosition, 500);

	updatePosition();
}

function updatePosition() {
	var selectedZone = players[currentState.selectedZone];
	var elapsedMillis = selectedZone.state.elapsedTime*1000 + (new Date().valueOf() - selectedZone.stateTime);
	
	var elapsed = Math.floor(elapsedMillis/1000);
	document.getElementById("countup").textContent = toFormattedTime(elapsed);
	var remaining = selectedZone.state.currentTrack.duration - elapsed;
	document.getElementById("countdown").textContent = "-" + toFormattedTime(remaining);
	var positionPercent = elapsedMillis / (selectedZone.state.currentTrack.duration*1000)*100;
	setPositionPercent(positionPercent);
}

function updateControllerState() {
	console.log(players[currentState.selectedZone])
	var state = players[currentState.selectedZone].state.zoneState;
	var playPauseButton = document.getElementById('play-pause');

	if (state == "PLAYING") {
		playPauseButton.src = '/images/pause_normal.png';
	} else {		
		playPauseButton.src = '/images/play_normal.png';
	}
}

// Update position
function setPositionPercent(percent) {
	// 0-100
	var positionBar = document.getElementById("position-bar");
	var positionScrubber = document.getElementById("position-bar-scrubber");

	// total width
	var allowedWidth = positionBar.clientWidth - 5;

	// calculate offset
	var offset = Math.round(allowedWidth * percent / 100);

	positionScrubber.style.marginLeft = offset + "px";

}


function toFormattedTime(seconds) {



	  var chunks = [];
	  var modulus = [60^2, 60];
	  var remainingTime = seconds;
	  // hours
	  var hours = Math.floor(remainingTime/3600);

	  if (hours > 0) {
	    chunks.push(zpad(hours, 1));
	    remainingTime -= hours * 3600;
	  }

	  // minutes
	  var minutes = Math.floor(remainingTime/60);
	  chunks.push(zpad(minutes, 1));
	  remainingTime -= minutes * 60;
	  // seconds
	  chunks.push(zpad(Math.floor(remainingTime), 2))
	  return chunks.join(':');
}

function zpad(number, width) {
  var str = number + "";
  if (str.length >= width) return str;
  var padding = new Array(width - str.length + 1).join('0');
  return padding + str;
}

function volumeSlider(containerObj, callback) {
	var state = {
		originalX: 0,
		maxX: 0,
		currentX: 0,
		slider: null,
		volume: 0
	};

	function onDrag(e) {
		var deltaX = e.clientX - state.originalX;
		var nextX = state.currentX + deltaX;
		
		if ( nextX > state.maxX ) nextX = state.maxX;
		else if ( nextX < 1) nextX = 1;

		state.slider.style.marginLeft = nextX + 'px';

		// calculate percentage
		var volume = Math.floor(nextX / state.maxX * 100);
		if (volume != state.volume && callback) {
			callback(state.volume);			
		}
		state.volume = volume;
	}

	var volumeScrubber = containerObj.querySelector('img');

	volumeScrubber.addEventListener('mousedown', function (e) {
		state.slider = this;
		state.originalX = e.clientX;
		var sliderWidth = this.parentNode.clientWidth;
		state.maxX = sliderWidth - 21;
		state.currentX = this.offsetLeft;
		document.addEventListener('mousemove', onDrag);
		e.preventDefault();
	});
	
	document.addEventListener('mouseup', function () {
		document.removeEventListener('mousemove', onDrag);				
	});

	return this;
}

function reRenderZones() {

	var oldWrapper = document.getElementById('zone-wrapper');
	var newWrapper = oldWrapper.cloneNode(false);
		
	for (var groupUUID in grouping) {
		var ul = document.createElement('ul');
		ul.id = groupUUID;

		if (ul.id == currentState.selectedZone)
			ul.className = "selected";

		var groupButton = document.createElement('button');
		groupButton.textContent = "Group";
		ul.appendChild(groupButton);

		grouping[groupUUID].forEach(function (playerUUID) {
			var player = players[playerUUID];
			var li = document.createElement('li');
			var span = document.createElement('span');
			span.textContent = player.roomName;
			li.appendChild(span);
			ul.appendChild(li);
		});

		newWrapper.appendChild(ul);	
	}
	oldWrapper.parentNode.replaceChild(newWrapper, oldWrapper);
}
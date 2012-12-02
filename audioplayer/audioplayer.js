var audioPlayer = new function() {
	
	var self = this;
	var $ = jQuery;

	var idiot = function (value) {
		return function () { return value; }
	}

	var attachPlaylistEvents = function() {

		var playlist = getAudioSet();
		var meta = $.makeArray($(self.containerID + " .playlistEntry"));
		for (var i = 0; i < playlist.length-1; i++)
		{
			var currentSong = playlist[i];
			var nextSong = playlist[i+1];

			var currentMeta = meta[i];

			currentMeta.addEventListener("click", makePlayer(currentSong));
			currentSong.addEventListener("play", makePlayEvent(currentSong, nextSong))
			currentSong.addEventListener("ended", makeEndEvent(currentSong, nextSong));
			currentSong.addEventListener("timeupdate", makeTimeUpdater(currentSong, nextSong))		
		}

	}



	var makeEndEvent = function (song, nextSong) {
		return function () {
			self.getCurrentTrack = idiot(nextSong);
			self.play = makePlayer(nextSong);
			self.back = makePlayer(song);
			self.play();
		}
	}

	var makePlayEvent = function (song, nextSong) {
		return function () {
			self.next = makePlayer(nextSong);
			_.chain(getAudioSet())
				.filter(function (track) { return track != song })
				.map(stopTrack);

		}
	}

	var updateTimes = function (track) {
		$("#trackLength").html(getTimeSigniture(track.duration));
		$("#trackTime").html(getTimeSigniture(track.currentTime)); 
		$("#apCtrlProgress").slider("option", "value", (track.currentTime/track.duration)*100)
	}

	var updateInterface = function (track) {
			$("#trackDescription").html(track.parentNode.children[0].innerText);
			updateTimes(track);
	}
	
	var makePlayer = function (track) {
		return 	function () {
			if (isNaN(track.duration)) {
				track.load();	
			}
			track.play();
			updateInterface(track);
		}
	}

	var makeTimeUpdater = function (track, nextTrack) {
		var loadNext = _.once(function () { nextTrack.load() });
		return 	function () {
			var delta = track.duration - track.currentTime;
			if (isNaN(nextTrack.duration)  && delta < 5) {
				loadNext();
			}
			updateTimes(track);
		}
		
	}

	var getTimeSigniture = function (seconds) {
		var min = padder(parseInt(Math.floor(seconds/60), 10) || 0, 2);
		var sec = padder(parseInt(seconds - (min * 60), 10) || 0, 2);
		return [min, sec].join(":");
		function padder(num, padding) {
			return (new Array(padding-(num+'').length + 1)).join('0') + num;
		}
	}


	var getAudioSet = function () {
		return $.makeArray($(self.containerID + " audio"));
	}

	var getTemplate = function (name) {
		return _.template($("#"+name).html());
	}

	var renderSet = function (set, name){
		var template = getTemplate(name);
		var rendered = _(set).map(template);
		return rendered.join('\n');
	}

	self.setContainer = function (containerID) {
		self.containerID = "#" + containerID;
		$("#apCtrlPlay").click( function () { self.play();  });
		$("#apCtrlPause").click(function () { self.pause(); });
		$("#apCtrlStop").click( function () { self.stop();  });
		$("#apCtrlNext").click( function () { self.next();  });
		$("#apCtrlVolume").slider({
			min : 0,
			max : 100,
			value : 100,
			change : function (event, ui) { _(getAudioSet()).each(function (track) {track.volume = (ui.value/100)})  }
		});
		$("#apCtrlProgress").slider({
			min : 0,
			max : 100,
			value : 0,
			range: "min",
			change : function (event, ui) {
				var song = self.getCurrentTrack();
				if (song && event.originalEvent) {
					var newTime = song.duration * (ui.value/100);
					var delta = Math.abs(song.currentTime - newTime)
					if (delta > 5) {
						song.currentTime = newTime;	
					}	
				}
			}
		});
	}

	self.loadPlaylist = function (playlist) {
		var container = $(self.containerID);
		if (playlist.length) {
			_(playlist).each(function (obj) { obj.streams = renderSet(obj.streams, 'tplStreamSource'); });
			container.html(renderSet(playlist, "tplPlaylistRecord"));
			var audioSet = getAudioSet();
			var firstSong = audioSet[0];
			var nextSong = audioSet[1];
			self.play = makePlayer(firstSong);
			self.next = makePlayer(nextSong);
			self.getCurrentTrack = idiot(firstSong);
			firstSong.load();
			attachPlaylistEvents();	
		}
		else
		{
			container.html("Contains no streamable content");
		}
		
	}

	var stopTrack = function (track) { 
		try {
			track.pause();
			track.currentTime = 0;	
		}
		catch (e)
		{
			//Perhaps deals with INVALID_STATE_ERR DOM Exception 11
		}
		
		return track;
	}

	var pauseTrack = function (track) {
		try {
			track.pause();
		}
		catch (e)
		{
			//Perhaps deals with INVALID_STATE_ERR DOM Exception 11
		}
		
		return track;	
	}

	self.pause = function () {
		_(getAudioSet()).each(pauseTrack);
	}

	self.stop = function () {
		_(getAudioSet()).each(stopTrack);
	}

	self.play = function () {};

	self.next = function () {};

	self.back = function () {};

	self.getCurrentTrack = function () {};
};
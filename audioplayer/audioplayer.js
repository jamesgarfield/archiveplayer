var audioPlayer = new function() {
	
	var self = this;
	var $ = jQuery;

	var currentSong = null;

	var attachPlaylistEvents = function() {

		var playlist = getAudioSet();
		var meta = $.makeArray($(self.containerID + " .songmetainfo"));
		for (var i = 0; i < playlist.length-1; i++)
		{
			var currentSong = playlist[i];
			var nextSong = playlist[i+1];

			var currentMeta = meta[i];

			currentSong.addEventListener("play", makePlayEvent(currentSong, nextSong))
			currentMeta.addEventListener("click", makePlayer(currentSong, nextSong));
			currentSong.addEventListener("ended", makeEndEvent(currentSong, nextSong));
			currentSong.addEventListener("timeupdate", makeTimeUpdater(currentSong, nextSong))		
		}

	}

	var makeEndEvent = function (song, nextSong) {
		return function () {
			self.currentSong = null;
			nextSong.play();
			nextSong.volume = song.volume;
		}
	}

	var makePlayEvent = function (song, nextSong) {
		return function () {
			if (self.currentSong && self.currentSong != song) {
				self.currentSong.pause();
				self.currentSong.currentTime = 0;
			}
			$("#apCtrlProgress").slider("option", "value", 0)
			self.currentSong = song;
			$("#trackDescription").html(song.parentNode.children[0].innerText);
			$("#trackLength").html(getTimeSigniture(song.duration));
			//nextSong.load(); //buffer next file
		}
	}

	var makePlayer = function (song) {
		return function () { song.play(); }
	}

	var makeTimeUpdater = function (song, nextSong) {
		var loading = false;
		return function () {
			$("#trackTime").html(getTimeSigniture(self.currentSong.currentTime)); 
			$("#trackLength").html(getTimeSigniture(song.duration));
			if (!loading && song.duration - song.currentTime < 5) {
				loading = true;
				nextSong.load();
			}
			$("#apCtrlProgress").slider("option", "value", (song.currentTime/song.duration)*100)
		}
	}


	var padder = function (num, padding) {
		return (new Array(padding-(num+'').length + 1)).join('0') + num;
	}

	var getTimeSigniture = function (seconds) {
		var min = padder(parseInt(Math.floor(seconds/60), 10) || 0, 2);
		var sec = padder(parseInt(seconds - (min * 60), 10) || 0, 2);
		return [min, sec].join(":");
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
		$("#apCtrlPlay").click(function (){ 
			self.currentSong.play() });
		$("#apCtrlPause").click(function (){ 
			self.currentSong.pause() });
		$("#apCtrlStop").click(function (){ 
			self.currentSong.pause(); self.currentSong.currentTime = 0; });
		$("#apCtrlNext").click(function (){ 
			self.currentSong.currentTime = self.currentSong.duration; });
		$("#apCtrlVolume").slider({
			min : 0,
			max : 100,
			value : 100,
			change : function (event, ui) { self.currentSong.volume = (ui.value/100)  }
		});
		$("#apCtrlProgress").slider({
			min : 0,
			max : 100,
			value : 0,
			range: "min",
			change : function (event, ui) {
				var song = self.currentSong;
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
			var firstSong = getAudioSet()[0];
			firstSong.load();
			self.currentSong = firstSong;
			attachPlaylistEvents();	
		}
		else
		{
			container.html("Contains no streamable content");
		}
		
	}
};
var audioPlayer = new function() {
	
	var self = this;
	var $ = jQuery;

	//For a given value, return a function that always returns that value
	var idiot = function (value) {
		return function () { return value; }
	}


	/**
	 * Get all the audio tags in the player container
	 * @return {Array<HTMLAudioElement>}
	 */
	var getAudioSet = function () {
		return $.makeArray($(self.containerID + " audio"));
	}

	/**
	 * Attach events to all audio tags and their corresponding meta data
	 * @return {undefined}
	 */
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

	/**
	 * Return a function that plays a given track
	 * @param  {[HTMLAudioElement} track 
	 * @return {Function}
	 */
	var makePlayer = function (track) {
		return 	function () {
			if (isNaN(track.duration)) {
				track.load();	
			}
			track.play();
			updateInterface(track);
		}
	}

	/**
	 * Deal with what happens at the end of a song
	 * @param  {HTMLAudioElement} song     
	 * @param  {HTMLAudioElement} nextSong 
	 * @return {Function}
	 */
	var makeEndEvent = function (song, nextSong) {
		return function () {
			self.getCurrentTrack = idiot(nextSong);
			self.play = makePlayer(nextSong);
			self.back = makePlayer(song);
			self.play();
		}
	}

	/**
	 * Deal with what happens when a song starts playing
	 * @param  {HTMLAudioElement} song     
	 * @param  {HTMLaudioElement} nextSong 
	 * @return {Function}
	 */
	var makePlayEvent = function (song, nextSong) {
		return function () {
			self.next = makePlayer(nextSong);
			//Stop every song that is not this song in the playlist
			_.chain(getAudioSet())
				.filter(function (track) { return track != song })
				.map(stopTrack);

		}
	}

	/**
	 * Update times and progress bars for a given track
	 * 
	 * @param  {HTMLAudioElement} track [description]
	 * @return {undefined}
	 */
	var updateTimes = function (track) {
		$("#trackLength").html(getTimeSigniture(track.duration));
		$("#trackTime").html(getTimeSigniture(track.currentTime)); 
		$("#apCtrlProgress").slider("option", "value", (track.currentTime/track.duration)*100)
	}

	/**
	 * Update the player UI for a given track
	 * @param  {HTMLAudioElement} track 
	 * @return {undefined}
	 */
	var updateInterface = function (track) {
			$("#trackDescription").html(track.parentNode.children[0].innerText);
			updateTimes(track);
	}
	
	
	/**
	 * make a function that updates a the UI with current track time, and prelaods the next song when appropriate
	 * @param  {HTMLAudioElement} track     
	 * @param  {HTMLAudioElement} nextTrack 
	 * @return {undefined}
	 */
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

	/**
	 * Turns seconds into a time signiture (mm:ss)
	 * @param  {Number} seconds [description]
	 * @return {String}
	 */
	var getTimeSigniture = function (seconds) {
		var min = padder(parseInt(Math.floor(seconds/60), 10) || 0, 2);
		var sec = padder(parseInt(seconds - (min * 60), 10) || 0, 2);
		return [min, sec].join(":");
		function padder(num, padding) {
			return (new Array(padding-(num+'').length + 1)).join('0') + num;
		}
	}

	/**
	 * Return an Underscore template from the contents of a given id
	 * @param  {String} name ID of a template
	 * @return {_.template Function} 
	 */
	var getTemplate = function (name) {
		return _.template($("#"+name).html());
	}

	/**
	 * Render a template across a set of data
	 * @param  {Array} set  Data set to use ini template
	 * @param  {String} name ID of template
	 * @return {String}
	 */
	var renderSet = function (set, name){
		var template = getTemplate(name);
		var rendered = _(set).map(template);
		return rendered.join('\n');
	}

	/**
	 * Attach click handlers to elements in the container
	 * @param {String} containerID ID of the element containing the player
	 */
	self.setContainer = function (containerID) {
		self.containerID = "#" + containerID;
		$("#apCtrlPlay").click( function () { self.play();  });
		$("#apCtrlPause").click(function () { self.pause(); });
		$("#apCtrlStop").click( function () { self.stop();  });
		$("#apCtrlNext").click( function () { self.next();  });
		/*$("#apCtrlVolume").slider({
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
		});*/
	}

	/**
	 * Add the files in the playlist to the UI and setup events
	 * @param  {[type]} playlist [description]
	 * @return {[type]}
	 */
	self.loadPlaylist = function (playlist) {
		var container = $(self.containerID);
		if (playlist.length) {
			//Render the streaming sources as list elements
			_(playlist).each(function (obj) { obj.streams = renderSet(obj.streams, 'tplStreamSource'); });
			//Render the playlist element
			container.html(renderSet(playlist, "tplPlaylistRecord"));
			container.listview('refresh')
			var audioSet = getAudioSet();
			var firstSong = audioSet[0];
			var nextSong = audioSet[1];
			self.play = makePlayer(firstSong);
			self.next = makePlayer(nextSong);
			self.getCurrentTrack = idiot(firstSong);

			//Start loading the first song
			firstSong.load();
			attachPlaylistEvents();	
		}
		else
		{
			container.html("Contains no streamable content");
		}
		
	}

	/**
	 * Stops a given track
	 * @param  {HTMLAudioElement} track 
	 * @return {undefined}
	 */
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

	/**
	 * Pauses a given track
	 * @param  {HTMLAudioElement} track 
	 */
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

	/**
	 * Pause function that ensures pausing, even if multiple tracks are playing
	 */
	self.pause = function () {
		_(getAudioSet()).each(pauseTrack);
	}

	/**
	 * Stop function that ensures stopping even if multiple tracks are playing
	 * @return {[type]}
	 */
	self.stop = function () {
		_(getAudioSet()).each(stopTrack);
	}

	self.play = function () {};

	self.next = function () {};

	self.back = function () {};

	self.getCurrentTrack = function () {};
};
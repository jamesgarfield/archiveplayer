var archiveLoader = new function () {
	var self = this;
	var $ = jQuery;

	/**
	 * Given a name and a value, return a function that determines 
	 * if a passed object (obj) has a property corresponding to 'name' that
	 * has a value that is (or is in) 'value'
	 *
	 * e.g.
	 *   var all = [{name : "James", age:30}, {name:"Ben", age:24}]
	 *   var some = all.filter(propertyIs("age", 30));
	 *   ==> [{name : "James", age:30}]
	 * 
	 * @param  {String} name  Property name to check
	 * @param  {*|Array} value Value or array of values to look for
	 * @return {Function}
	 */
	var propertyIs = function (name, value) {
		if (value instanceof Array)
		{
			return function (obj) {
				return _(value).contains(obj[name]);
			}
		}
		else
		{
			return function (obj) {
				return obj[name] == value;
			}
		}
	}

	/**
	 * Performs an async call to the archive.org REST endpoint to retrieve data for a specific show
	 * 
	 * @async
	 * 
	 * @param {String} showID 
	 *
	 * @return {jQuery.Deferred} Returns a jQuery.Deferred object, mostly based on the Promises/A spec
	 */

	var getShowData = function (showID) {
		return $.ajax({
			url : "http://archive.org/details/" + showID + "&output=json", 
			dataType : 'jsonp'
		});
	}

	/**
	 * Async get a playlist for a given show
	 * @async
	 * @param  {String} showID 
	 * @return {{title:String, originalURL:String, taper:String, filed:Array}}}
	 */
	var getShowPlaylist = function (showID) {
		
		//Aysnc get the base data for the show and pipe the results to the playlist processor function
		return getShowData(showID).
			then(function translateIntoPlaylist(data, status) {
				
				//Initialize Objects
				var defaultCreator = data.metadata.collection[0];
				//Base location for files referenced in the returned data.
				var baseURL = "http://archive.org/download/" + (data.dir.split('/').pop());

				//For every file, add key, url creator, and title properties
				_(data.files).each(function (obj, key) { 
					//Key is the file name of this object
					obj.key = key.split('/').pop();
					//url is the streaming address for this file
					obj.url = baseURL + key;
					//creator is the artist
					obj.creator = obj.creator || defaultCreator;
					//Title is the title of the song
					obj.title = obj.title || key.split('.')[0];
				});
				
				//Transform the object into an array of values
				var files = _.values(data.files);
				
				//Determines if a given file is the "original file" from which any streaming versions are derived from
				//The original file is the one that contains the important metadata about a file
				var isOriginal = (function () {
					var isOriginalSource = propertyIs('source', 'original');
					var hasAllowedFormat = propertyIs('format', ['Flac', 'Shorten', 'Ogg Vorbis', 'VBR MP3', '64Kbps MP3']);
					
					return function (obj) {
						return (isOriginalSource(obj) && hasAllowedFormat(obj))
					}
				})();
				

				//For a given original file, returns a function that determines
				// if a different file is a streamable derivitive of the original
				var isStreamable = function (orig) {
					var isDerivative = propertyIs('original', orig.key);
					var isStreamable = propertyIs('format', ['Ogg Vorbis', 'VBR MP3', '64Kbps MP3']);
					return function (file) {
						return isDerivative(file) && isStreamable(file);
					}
				}

				//For a given original, add the streams as a property and return the original
				var getStreams = function (orig) {
					orig.streams = _(files).filter(isStreamable(orig)); 
					return orig; 
				}


				//Return if a original has streamable derivitives
				var hasStreams = function (orig) {
					return orig.streams.length > 0 
				}

				var setTrackLength = function(orig) {
					orig.tracklength = getTimeSigniture(parseInt(orig.length, 10))
					return orig;
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

				var audio = _.chain(files)	//for each file in the show
					.filter(isOriginal)		//filter down to just the original audio
					.map(getStreams)		//Find and add any streams
					.filter(hasStreams)		//filter down to only originals that have streamable content
					.map(setTrackLength)	//set tracklength property
					.value();				//Get the result
				
				//Construct a playlist object to pass back
				var playlist = {
					id : showID,
					title : ((data.metadata.title && data.metadata.title[0]) || "No Title"),	//Returned title, or "No Title" as a default
					originalURL : "http://archive.org/details/" + showID,
					taper : ((data.metadata.taper && data.metadata.taper[0]) || "None"), 		//Returned taper, or "None" as a default
					files : audio
				}
				return playlist;
			});
	}

	/**
	 * For a given query, aysnc return a random show from the found set as a playlist
	 * 
	 * @async
	 * @param  {String} query archive.org REST query fragment
	 * @return {getShowPlaylist}
	 */
	var randomShow = function (query) {
		return getRandomShowID(query).
			then(getShowPlaylist);
	}

	/**
	 * For a given query, async get a showID for a random show.
	 * @async
	 * @param  {String} query archive.org REST query fragment
	 * @return {String}
	 */
	var getRandomShowID = function getRandomShowID(query) {
		return self.search(query).
			then(function searchAgainForRandomPage(data, status) {
				return self.search(query, _.random(data.response.numFound) + 1);
			}).
			then(function getShowID(data, status) {
				return data.response.docs[0].identifier;
			});
	}

	self.getCollectionYearRange = function (collection) {
		var startYear, endYear;
		var query = "collection:" + collection + "&sort[]=date+asc&fl[]=date";
		return self
			.search(query)
			.then(function (data, status) {
				var d = new Date(data.response.docs[0].date);
				startYear = d.getUTCFullYear();
				return self.search(query, data.response.numFound);
			})
			.then(function (data, status) {
				var d = new Date(data.response.docs[0].date);
				endYear = d.getUTCFullYear();
				return _.range(startYear, endYear+1);
			});
	}

	self.getCollectionYear = function (collection, year) {

		var query = "collection:" + collection + " AND date:[" + year + "-01-01 TO " + (parseInt(year, 10)+1) +"-01-01]&sort[]=date+asc&fl[]=identifier&fl[]=date&fl[]=creator&fl[]=title";
		return self
			.search(query, 1, 300)
			.then(function(data, status) {
				return data.response.docs;
			});
	}

	/**
	 * Given a archive.org REST query fragment, execute that query async and return a jQuery.Deferred promise
	 * @async
	 * @param  {String} query archive.org REST query fragment
	 * @param  {Number} [page]  Optional page number to return (default: 1)
	 * @return {jQuery.Deferred}
	 */
	self.search = function (query, page, rows) {
		page = page || 1;
		rows = rows || 1;
		return $.ajax({
			url : "http://archive.org/advancedsearch.php?q=" + query + "&fl[]=identifier&rows=" + rows + "&page=" + page + "&output=json", 
			dataType : 'jsonp'
		});
	}

	
	/**
	 * For a given EXACT collection name (artist name) create an archive.org query fragment and return a random show playlist
	 * @async
	 * @param  {String} collection 
	 * @return {getShowPlaylist}
	 */
	self.randomShowByCollection = function(collection) {
		return randomShow("collection:" + collection);
	}

	/**
	 * For a taper name (or partial) does an inexact search for etree collections (audio) by that taper 
	 * @async
	 * @param  {String} taper
	 * @return {getShowPlaylist}
	 */
	self.randomShowByTaper = function (taper) {
		return randomShow('collection:"etree" AND (taper:(' +  taper + "))");
	}

	/**
	 * Do an advanced search on one or more fields
	 * @param  {String} collection aka artist
	 * @param  {String} taper   
	 * @param  {String} year    
	 * @param  {String} venue   
	 * @return {getShowPlaylist}
	 */
	self.randomShowByAdvancedSearch = function (collection, taper, year, venue, avg_rating) {
		var query = 'collection:' + (collection || '"etree"');
		if (taper) {
			query += " AND (taper:(" + taper + "))";
		}
		if (year) {
			query += " AND year:" + year;
		}
		if (venue) {
			query += " AND (venue:(" + venue + "))";
		}
		if (avg_rating) {
			query += " AND (avg_rating:[\"" + avg_rating + "\" TO \"5\"])";
		}
		return randomShow(query);
	}

	self.showByID = function(showID) {
		return getShowPlaylist(showID);
	}

	/**
	 * Returns a list of valid collections (artists) that have streamable content
	 * @async
	 * @return {jQuery.Deferred}
	 */
	self.getCollections = function () {
		return $.ajax({
			url : "http://archive.org/advancedsearch.php?q=mediatype%3Acollection+AND+collection%3Aetree&fl[]=identifier&fl[]=title&sort[]=titleSorter+asc&rows=6000&page=1&output=json", 
			dataType : 'jsonp'
		});
	}




};

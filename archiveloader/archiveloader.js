var archiveLoader = new function () {
	var self = this;
	var $ = jQuery;

	var useHistory = ('history' in window)

	self.searchBoxID = null;

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

	var getShowPlaylist = function (showID) {
		
		return getShowData(showID).
			pipe(function (data, status) {
				test = data;
				//Initialize Objects
				var defaultCreator = data.metadata.collection[0];
				var baseURL = "http://archive.org/download/" + (data.dir.split('/').pop());
				_(data.files).each(function (obj, key) { 
					obj.key = key.split('/').pop();
					obj.url = baseURL + key 
					obj.creator = obj.creator || defaultCreator;
					obj.title = obj.title || key.split('.')[0];
				});
				
				var files = _.values(data.files);
				//Get target sources
				var isOriginal = (function () {
					var isOriginalSource = propertyIs('source', 'original');
					var hasAllowedFormat = propertyIs('format', ['Flac', 'Shorten', 'Ogg Vorbis', 'VBR MP3', '64Kbps MP3']);
					
					return function (obj) {
						return (isOriginalSource(obj) && hasAllowedFormat(obj))
					}
				})();
				
				var streamables = function (obj) {
					var isDerivative = propertyIs('original', obj.key);
					var isStreamable = propertyIs('format', ['Ogg Vorbis', 'VBR MP3', '64Kbps MP3']);
					return function (file) {
						return isDerivative(file) && isStreamable(file);
					}
				}

				var audio = _.chain(files)
					.filter(isOriginal)
					.map(function (obj) {
						 obj.streams = _(files).filter(streamables(obj)); return obj; 
					})
					.filter(function (obj) {
					 	return obj.streams.length > 0 
					 })
					.value();
				
				var playlist = {
					title : ((data.metadata.title && data.metadata.title[0]) || "No Title"),
					originalURL : "http://archive.org/details/" + showID,
					taper : ((data.metadata.taper && data.metadata.taper[0]) || "None"),
					files : audio
				}
				return playlist;
			});
	}

	var getShowData = function getShowData(showID) {
		return $.ajax({
			url : "http://archive.org/details/" + showID + "&output=json", 
			dataType : 'jsonp'
		});
	}

	var randomShow = function (query) {
		return getRandomShowID(query).
			pipe(getShowPlaylist);
	}

	var getRandomShowID = function getRandomShowID(query) {
		return self.search(query).
			pipe(function (data, status) {
				return _.random(data.response.numFound) + 1;
			}).
			pipe(function (page) {
				return self.search(query, page);
			}).
			pipe(function (data, status) {
				return data.response.docs[0].identifier;
			});
	}

	self.search = function (query, page) {
		return $.ajax({
			url : "http://archive.org/advancedsearch.php?q=" + query + "&fl[]=identifier&rows=1&page=" + (page || 1) + "&output=json", 
			dataType : 'jsonp'
		});
	}

	self.randomShowByCollection = function(collection) {
		return randomShow("collection:" + collection);
	}

	self.randomShowByTaper = function (taper) {
		randomShow('collection:"etree" AND (taper:(' +  taper + "))");
	}

	self.showByID = function(showID) {
		loadShow(showID);
	}

	self.getCollections = function () {
		return $.ajax({
			url : "http://archive.org/advancedsearch.php?q=mediatype%3Acollection+AND+collection%3Aetree&fl[]=identifier&fl[]=title&sort[]=titleSorter+asc&rows=6000&page=1&output=json", 
			dataType : 'jsonp'
		});
	}
};
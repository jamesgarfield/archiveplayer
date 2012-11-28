var archiveLoader = new function () {
	var self = this;
	var $ = jQuery;


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

	var loadShow = function (showURL) {
		$.ajax({
			url : showURL, 
			dataType : 'jsonp', 
			success : function (data, status) {
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

				var playlist = _.chain(files)
					.filter(isOriginal)
					.map(function (obj) { obj.streams = _(files).filter(streamables(obj)); return obj; })
					.filter(function (obj) { return obj.streams.length > 0 } )
					.value();

				$("#showTitle").html((data.metadata.title && data.metadata.title[0]) || "No Title");
				$("#showTaper").html("Taper: " + (data.metadata.taper && data.metadata.taper[0]) || "None");
				audioPlayer.loadPlaylist(playlist);
			},
		});	
	}

	var randomShow = function (query, showNumber) {
		var page = (showNumber == null) ? 1 : showNumber + 1;
		var searchURL = "http://archive.org/advancedsearch.php?q=" + query + "&fl[]=identifier&rows=1&page=" + page + "&output=json"
		$.ajax({
			url : searchURL, 
			dataType : 'jsonp', 
			success : function (data, status) {
				test = data;
				
				if (showNumber != null) {
					var id = data.response.docs[0].identifier;
					var showURL = "http://archive.org/details/" + id + "&output=json";
					loadShow(showURL);
				}
				else
				{
					showNumber = _.random(data.response.numFound);
					randomShow(query, showNumber);
				}

			},
		});
	}

	self.randomShowByCollection = function(collection) {
		var query = "collection:" + collection;
		randomShow(query);
	}

	self.initSearchBox = function (searchBoxID) {
		$.ajax({
			url : "http://archive.org/advancedsearch.php?q=mediatype%3Acollection+AND+collection%3Aetree&fl[]=identifier&fl[]=title&sort[]=titleSorter+asc&rows=6000&page=1&output=json", 
			dataType : 'jsonp', 
			success : function (data, status) {
				var collections = _(data.response.docs).map(function (c) {  return {label: c.title, value:c.identifier}  });

				$("#" + searchBoxID).autocomplete({source:collections});

			},
		});
	}
};
//Adds function _.propertySelect to the Underscore library
_.mixin({
	propertySelect : 	(function (key) {
							return function (obj) { return obj[key]; }
						}),
});


(function ($){
	$(document).ready(function (){
		
		audioPlayer.setContainer("playlistContainer");
		
		function goingToTheShow(showID) {
			var pplaylist = archiveLoader.showByID(showID)
			pplaylist.then(showPlaylist)
		}

		var router = Router({
			"archive/random/artist/:artistName" : archiveLoader.randomShowByCollection,
			"archive/show/:showID" : goingToTheShow,
			"playlist" : pageRouter,
			"results" : pageRouter,
		});
		router.init();

		archiveLoader.getCollections()
			.then(function (data, status) {
				var collections = _(data.response.docs).map(function (c) {  return {label: c.title, value:c.identifier}  });
				$("#artistSearchBox").autocomplete({source:collections});
				$("#advSearchArtist").autocomplete({source:collections});
			});


		function pageRouter() {
			var location = window.location;
			var search = location.search;

			if (!search) {
				$.mobile.changePage("#search");
				return;
			}
			var parts = search.slice(1).split('&');
			var params = _.reduce(parts, function(params, p) {
				var part = p.split('=');
				params[part[0]] = part[1];
				return params;
			}, {})
			if (params.show && params.source == "archive") {
				goingToTheShow(params.show);
			}
			else if (params.artist && params.year) {
				loadArtistYear(params.artist, params.year);
			}
			else if (params.artist && params.find == "range") {
				loadArtistYearRange(params.artist);
			}
			else {
				$.mobile.changePage("#search");
			}
		}

		var showPlaylist = function (playlist) {
			$.mobile.changePage("#playlist");
			var location = "?show=" + playlist.id + "&source=archive#results";
			window.history.replaceState({}, "", location);
			$("#showTitle").html('<a href="' + location +'" window="_blank">' + playlist.title +"</a>" );
			$("#originalSource").html('<a href="' + playlist.originalURL +'" window="_blank">Taped by ' + playlist.taper + " @ archive.org</a>" );
			audioPlayer.loadPlaylist(playlist.files);
		}



		var pickRandomShow = function (searchFunc, attempt) {
			$.mobile.loading('show', {
				text : "Finding playlist...", 
				textVisible : true,
				theme : 'a'
			});
			searchFunc().
				then(function (playlist) {
					if (playlist.files.length > 0) {
						$.mobile.loading('hide');
						//showPlaylist(playlist);
						var location = "?show=" + playlist.id + "&source=archive#results";
						window.location.pushState({}, "", location);
					}
					else if (attempt < 30){
						pickRandomShow(collection, (attempt || 0) + 1);
					}
					else
					{
						$.mobile.loading('hide');
						alert("Could Not Find a Show");
					}
				});
		}

		$("#artistSearchBox").keypress(function (event) {
			if (event.which == 13) //Enter Key
			{
				var searchFunc = _.bind(archiveLoader.randomShowByCollection, archiveLoader, [$("#artistSearchBox").val()]);
				pickRandomShow(searchFunc);
			}
		});
		
		$("#artistSearchBtn").click(function () { 
			var searchFunc = _.bind(archiveLoader.randomShowByCollection, archiveLoader, [$("#artistSearchBox").val()]);
			pickRandomShow(searchFunc);
		});

		$("#artistListBtn").click(function () { 
			var artist = $("#artistSearchBox").val();
			window.location = "/?artist=" + artist + "&find=range#results"
			//loadArtistYearRange(artist);
		});

		function loadArtistYearRange(artist) {
			archiveLoader.getCollectionYearRange(artist)
			.then(function(years) {
				listArtistYearRange(artist, years);
			})
		}

		function loadArtistYear(artist, year) {
			archiveLoader.getCollectionYear(artist, year)
				.then(function(shows) {
					listArtistYear(artist, year, shows);
				});
		}

		function listArtistYearRange(artist, years) {
			$.mobile.changePage("#results");
			window.history.replaceState({}, "", "?artist=" + artist + "&find=range#results");
			$("#resultTitle")[0].innerText = [artist, "Years"].join(' ');
			years.reverse();
			var list = $("#resultList")[0];
			$(list).off("click", "li");
			$(list).empty();
			years.forEach(function (y) {
				var li = document.createElement("li");
				var html = '<a href="?artist=' + artist + "&year=" + y + '#results">' + y + "</a>";
				li.innerHTML = html;
				list.appendChild(li);
			});
			$(list).listview('refresh');
			/*$(list).on("click", "li", function(event) {
				var year = parseInt(this.innerText, 10);
				loadArtistYear(artist, year);
			});*/
		}

		function listArtistYear(artist, year, shows) {
			$.mobile.changePage("#results");
			window.history.replaceState({}, "", "?artist=" + artist + "&year=" + year + "#results");
			$("#resultTitle")[0].innerText = [artist, year].join(' - ');
			var list = $("#resultList")[0];
			$(list).off("click", "li");
			$(list).empty();

			shows.forEach(function (s) {
				var li = document.createElement("li");
				var location = "?show=" + s.identifier + "&source=archive#results";
				var title = s.avg_rating ? (s.title + ' (' + s.avg_rating + ')' ) : s.title;
				li.innerHTML = '<a href="' + location + '">' + title + '</a>';
				$(li).attr("data-showid", s.identifier);
				list.appendChild(li);
			});
			$(list).listview('refresh');/*
			$(list).on("click", "li", function(event) {
				var showID = $(this).attr("data-showid");
				goingToTheShow(showID);
			});*/
		}

		$("#taperSearchBox").keypress(function (event) {
			if (event.which == 13) //Enter Key
			{
				var searchFunc = _.bind(archiveLoader.randomShowByTaper, archiveLoader, [$("#taperSearchBox").val()]);
				pickRandomShow(searchFunc);
			}
		});
		
		$("#taperSearchBtn").click(function () { 
			var searchFunc = _.bind(archiveLoader.randomShowByTaper, archiveLoader, [$("#taperSearchBox").val()]);
			pickRandomShow(searchFunc);
		});

		$("#advSearchBtn").click(function () { 
			var  collection = $("#advSearchArtist").val(), 
				 taper = $("#advSearchTaper").val(), 
				 year = $("#advSearchYear").val(), 
                 venue = $("#advSearchVenue").val(),
                 avg_rating = $("#advSearchRating").val();

			var searchFunc = _.bind(archiveLoader.randomShowByAdvancedSearch, archiveLoader, collection, taper, year, venue, avg_rating);
			pickRandomShow(searchFunc);
		});

		//Fire the router in case we are going directly to a path
		router.handler();

	})
})(jQuery);
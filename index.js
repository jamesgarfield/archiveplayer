//Adds function _.propertySelect to the Underscore library
_.mixin({
	propertySelect : 	(function (key) {
							return function (obj) { return obj[key]; }
						}),
});


(function ($){
	$(document).ready(function (){
		
		audioPlayer.setContainer("playlistContainer");
		
		var router = Router({
			"archive/random/artist/:artistName" : archiveLoader.randomShowByCollection,
			"archive/show/:showID" : goingToTheShow,
			"playlist" : locationRouter,
			"results" : locationRouter,
		});
		router.init();

		archiveLoader.getCollections()
			.then(function (data, status) {
				var collections = _(data.response.docs).map(function (c) {  return {label: c.title, value:c.identifier}  });
				$("#artistSearchBox").autocomplete({source:collections});
				$("#advSearchArtist").autocomplete({source:collections});
			});

		window.addEventListener('popstate', popStateRouter);

		function buildLocation(param, page) {
			var location = window.location.pathname;
			var queryParam = [];
			if (param) {
				for (col in param)	{
					queryParam.push([col, param[col]].join('='));
				}
			}
			var query = queryParam.join('&');
			if (query.length) {
				location = [location, query].join('?');
			}
			if (page) {
				var delim = page[0] == '#' ? '' : '#';
				location = [location, page].join(delim);
			}
			return location;
		}

		function setLocation(param, page) {
			var location = buildLocation(param, page);
			
			$.mobile.changePage(page);
			
			var currentLocation = [window.location.pathname + window.location.search + window.location.hash].join('') 
			if (currentLocation != location) {
				window.history.pushState({
					params : param,
					page: page
				}, page, location);		
			}
			
			return location;
		}

		function goingToTheShow(showID) {
			var pplaylist = archiveLoader.showByID(showID)
			pplaylist.then(showPlaylist)
		}

		function locationRouter() {
			var location = window.location;
			var search = location.search;
			var page = location.hash;
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
			baseRouter(params, page)
		}

		function popStateRouter(event) {
			var state = event.state;
			var params = state ? state.params : {};
			var page = state ? state.page : '#search';
			baseRouter(params, page);
		}

		function baseRouter(params, page) {
			//setLocation(params, page);
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
			var location = setLocation({
				show : playlist.id, 
				source: 'archive'
			}, "#playlist");
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
						showPlaylist(playlist);
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
				var artist = $("#artistSearchBox").val();
				if (artist) {
					loadArtistYearRange(artist);	
				}
			}
		});
		
		$("#artistSearchBtn").click(function () { 
			var searchFunc = _.bind(archiveLoader.randomShowByCollection, archiveLoader, [$("#artistSearchBox").val()]);
			pickRandomShow(searchFunc);
		});

		$("#artistListBtn").click(function () { 
			var artist = $("#artistSearchBox").val();
			if (artist) {
				loadArtistYearRange(artist);	
			}
		});

		function loadArtistYearRange(artist) {
			$.mobile.loading('show', {
				text : "Searching...", 
				textVisible : true,
				theme : 'a'
			});
			archiveLoader.getCollectionYearRange(artist)
			.then(function(years) {
				listArtistYearRange(artist, years);
				$.mobile.loading('hide');
			})
		}

		function loadArtistYear(artist, year) {
			$.mobile.loading('show', {
				text : "Searching...", 
				textVisible : true,
				theme : 'a'
			});
			archiveLoader.getCollectionYear(artist, year)
				.then(function(shows) {
					listArtistYear(artist, year, shows);
					$.mobile.loading('hide');
				});
		}

		function listArtistYearRange(artist, years) {
			var location = setLocation({
				artist: artist,
				find : 'range',
			}, "#results")
			
			$("#resultTitle")[0].innerText = [artist, "Years"].join(' ');
			years.reverse();
			var list = $("#resultList")[0];
			$(list).off("click", "li");
			$(list).empty();
			years.forEach(function (y) {
				var li = document.createElement("li");
				var searchLocation = buildLocation({
					artist : artist,
					year: y
				}, "#results");
				var html = '<a href="' + searchLocation + '">' + y + "</a>";
				li.innerHTML = html;
				list.appendChild(li);
			});
			$(list).listview('refresh');
			$(list).on("click", "li", function(event) {
				var year = parseInt(this.innerText, 10);
				loadArtistYear(artist, year);
				event.preventDefault();
			});
		}

		function listArtistYear(artist, year, shows) {
			setLocation({
				artist : artist,
				year : year
			}, '#results');
			
			$("#resultTitle")[0].innerText = [artist, year].join(' - ');
			var list = $("#resultList")[0];
			$(list).off("click", "li");
			$(list).empty();

			shows.forEach(function (s) {
				var li = document.createElement("li");
				var showLocation = buildLocation({
					show: s.identifier,
					source: 'archive'
				}, '#results');
				var title = s.avg_rating ? (s.title + ' (' + s.avg_rating + ')' ) : s.title;
				li.innerHTML = '<a href="' + showLocation + '">' + title + '</a>';
				$(li).attr("data-showid", s.identifier);
				list.appendChild(li);
			});
			$(list).listview('refresh');
			$(list).on("click", "li", function(event) {
				var showID = $(this).attr("data-showid");
				goingToTheShow(showID);
				event.preventDefault();
			});
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
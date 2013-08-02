/*
 * Copyright 2013 Sarah Vessels
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-42851748-1']);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script');
  ga.type = 'text/javascript';
  ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0];
  s.parentNode.insertBefore(ga, s);
})();

var imdb_spotter_popup = {
  get_spotify_track_search_url: function(query) {
    return 'http://ws.spotify.com/search/1/track.json?q=' +
            encodeURIComponent(query);
  },

  get_spotify_trackset_url: function(name, track_ids) {
    var joined_ids = track_ids.join(',');
    return 'spotify:trackset:' + name + ':' + joined_ids;
  },

  get_spotify_trackset_web_url: function(name, track_ids) {
    var joined_ids = track_ids.join(',');
    return 'https://play.spotify.com/trackset/' + encodeURIComponent(name) +
           '/' + joined_ids;
  },

  get_spotify_track_id: function(app_url) {
    return app_url.split('spotify:track:')[1];
  },

  get_spotify_track_web_url: function(app_url) {
    return 'https://play.spotify.com/track/' +
           this.get_spotify_track_id(app_url);
  },

  set_trackset_link: function(spotify_choice) {
    var link = $('a#trackset-link');
    var track_ids = [];
    $('#track-list .track-link').each(function() {
      var track_id = $(this).attr('data-spotify').split('spotify:track:')[1];
      track_ids.push(track_id);
    });
    var trackset_name = 'Turntable.fm';
    var trackset_url = this.get_spotify_trackset_url(trackset_name, track_ids);
    var web_url = this.get_spotify_trackset_web_url(trackset_name, track_ids);
    link.click(function() {
      if (spotify_choice === 'desktop_application') {
        chrome.tabs.create({url: trackset_url});
      } else {
        chrome.tabs.create({url: web_url});
      }
      return false;
    });
    link.removeClass('hidden');
  },

  get_track_list_item: function(track) {
    var title = this.strip_quotes(track.title);
    var artist = this.strip_quotes(track.artist);
    return $('#track-list li[data-title="' + title + '"][data-artist="' +
             artist + '"]');
  },

  set_track_link: function(track, is_last, spotify_choice) {
    var query = this.strip_punctuation(track.title) + ' ' + track.artist;
    var url = this.get_spotify_track_search_url(query);
    var me = this;
    $.getJSON(url, function(data) {
      if (data && data.info && data.info.num_results > 0) {
        var spotify_url = data.tracks[0].href;
        var web_url = me.get_spotify_track_web_url(spotify_url);
        var list_item = me.get_track_list_item(track);
        var spotify_link = $('<a href="' + web_url +
                             '" data-spotify="' + spotify_url +
                             '" class="track-link"></a>');
        spotify_link.click(function() {
          if (spotify_choice === 'desktop_application') {
            chrome.tabs.create({url: spotify_url});
          } else {
            chrome.tabs.create({url: web_url});
          }
          return false;
        });
        spotify_link.append(list_item.children().detach());
        list_item.append(spotify_link);
      }
      if (is_last) {
        me.set_trackset_link(spotify_choice);
      }
    });
  },

  set_spotify_links: function(tracks, spotify_choice) {
    $('a#trackset-link').addClass('hidden');
    var num_tracks = tracks.length;
    for (var i=0; i<num_tracks; i++) {
      this.set_track_link(tracks[i], i == num_tracks - 1, spotify_choice);
    }
  },

  strip_quotes: function(str) {
    return str.replace(/"/, "'");
  },

  populate_track_list: function(tracks) {
    var track_list = $('#track-list');
    track_list.empty();
    for (var i=0; i<tracks.length; i++) {
      var track = tracks[i];
      var li = $('<li></li>');
      var title_span = $('<span class="title"></span>');
      title_span.text(track.title);
      li.append(title_span);
      var artist_span = $('<span class="artist"></span>');
      artist_span.text(track.artist);
      li.append(artist_span);
      li.attr('data-artist', this.strip_quotes(track.artist));
      li.attr('data-title', this.strip_quotes(track.title));
      track_list.append(li);
    }
  },

  setup_options_link: function() {
    $('a[href="#options"]').click(function() {
      chrome.tabs.create({url: chrome.extension.getURL("options.html")});
      return false;
    });
  },

  populate_popup: function(tracks) {
    this.populate_track_list(tracks);
    var me = this;
    chrome.storage.sync.get('imdb_spotter_options', function(opts) {
      opts = opts.imdb_spotter_options || {};
      var spotify_choice = opts.spotify || 'web_player';
      me.set_spotify_links(tracks, spotify_choice);
    });
  },

  get_artist: function(song_el) {
    var links = $('a', song_el);
    var artist = $.map(links, function(el) {
      var preceding_text = $.trim(el.previousSibling.nodeValue);
      if (preceding_text.indexOf('Performed by') > -1) {
        return el.textContent;
      }
    });
    if (artist.length > 0) {
      return artist[0];
    }
    var artist = $.map(links, function(el) {
      var preceding_text = $.trim(el.previousSibling.nodeValue);
      if (preceding_text.indexOf('Written by') > -1) {
        return el.textContent;
      }
      if (preceding_text.indexOf('Music by') > -1) {
        return el.textContent;
      }
    });
    if (artist.length > 0) {
      return artist[0];
    }
    return '';
  },

  strip_punctuation: function(str) {
    str = str.replace(/[\[\]\.,-\/#!$%"\^&\*;:{}=\-_`~()']/g, ' ');
    return $.trim(str.replace(/\s+/g, ' '));
  },

  get_imdb_soundtrack: function(imdb_id) {
    var url = 'http://www.imdb.com/title/' + imdb_id + '/soundtrack';
    $('#movie-link').attr('href', url).click(function() {
      chrome.tabs.create({url: url});
      return false;
    });
    var track_list = $('#track-list');
    var me = this;
    $.get(url, function(data) {
      var page = $(data);
      var song_els = $('.soundTrack', data);
      var tracks = [];
      var added_tracks = [];
      song_els.each(function() {
        var song_el = $(this);
        var title = $.map($('br', song_el), function(el) {
          return el.previousSibling.nodeValue;
        })[0];
        var artist = me.get_artist(song_el);
        var track = {title: title, artist: artist};
        var track_str = title + ' ' + artist;
        if (added_tracks.indexOf(track_str) == -1) {
          tracks.push(track);
          added_tracks.push(track_str);
        }
      });
      me.populate_popup(tracks);
    });
  },

  on_search: function() {
    var query_field = $('#query');
    var query = $.trim(query_field.val());
    if (query == '') {
      return;
    }
    var year_field = $('#year');
    var year = $.trim(year_field.val());
    var url = 'http://www.omdbapi.com/?t=' + encodeURIComponent(query);
    if (year != '') {
      url += '&y=' + encodeURIComponent(year);
    }
    var me = this;
    $.getJSON(url, function(data) {
      var wrapper = $('#movie-details-wrapper');
      if (!data || data.Response == 'False') {
        wrapper.hide();
        return;
      }
      $('#movie-title').text(data.Title);
      $('#movie-genre').text(data.Genre);
      $('#movie-rating').text(data.imdbRating);
      $('#movie-year').text(data.Year);
      if (data.Poster == 'N/A') {
        $('#movie-poster').hide();
      } else {
        $('#movie-poster').attr('src', data.Poster).show();
      }
      me.get_imdb_soundtrack(data.imdbID);
      wrapper.show();
    });
  },

  setup_search_form: function() {
    var me = this;
    $('#submit').click(function() {
      me.on_search();
    });
    $('form').submit(function(e) {
      e.preventDefault();
    });
  },

  on_popup_opened: function() {
    this.setup_options_link();
    this.setup_search_form();
  }
};

document.addEventListener('DOMContentLoaded', function() {
  chrome.tabs.getSelected(null, function(tab) {
    chrome.tabs.sendRequest(
      tab.id,
      {greeting: 'popup_opened', tab_id: tab.id},
      function() {
        imdb_spotter_popup.on_popup_opened();
      }
    );
  });
});

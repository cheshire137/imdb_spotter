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

const imdbSpotterPopup = {
  getSpotifyTrackSearchUrl: function(query) {
    return `http://ws.spotify.com/search/1/track.json?q=${encodeURIComponent(query)}`
  },

  getSpotifyTracksetUrl: function(name, trackIDs) {
    const joinedIDs = trackIDs.join(',')
    return `spotify:trackset:${name}:${joinedIDs}`
  },

  getSpotifyTracksetWebUrl: function(name, trackIDs) {
    const joinedIDs = trackIDs.join(',');
    return `https://play.spotify.com/trackset/${encodeURIComponent(name)}/${joinedIDs}`
  },

  getSpotifyTrackID: function(appUrl) {
    return appUrl.split('spotify:track:')[1]
  },

  getSpotifyTrackWebUrl: function(appUrl) {
    return `https://play.spotify.com/track/${this.getSpotifyTrackID(appUrl)}`
  },

  onTracksetLinkClick: function(event) {
    event.preventDefault()
    const spotifyChoice = event.target.getAttribute('data-spotify')
    if (spotifyChoice === 'desktop_application') {
      chrome.tabs.create({ url: tracksetUrl })
    } else {
      chrome.tabs.create({ url: webUrl })
    }
  },

  setTracksetLink: function(spotifyChoice) {
    const link = document.getElementById('trackset-link')
    link.setAttribute('data-spotify', spotifyChoice)

    const trackIDs = []
    const trackLinks = document.querySelectorAll('.track-link')
    for (const trackLink of trackLinks) {
      const spotifyAttr = trackLink.getAttribute('data-spotify')
      const trackID = spotifyAttr.split('spotify:track:')[1]
      trackIDs.push(trackID)
    }

    const tracksetName = 'Turntable.fm'
    const tracksetUrl = this.getSpotifyTracksetUrl(tracksetName, trackIDs)
    const webUrl = this.getSpotifyTracksetWebUrl(tracksetName, trackIDs)

    link.addEventListener('click', this.onTracksetLinkClick)
    link.classList.remove('hidden')
  },

  getTrackListItem: function(track) {
    const title = this.stripQuotes(track.title)
    const artist = this.stripQuotes(track.artist)
    const selector = `#track-list li[data-title="${title}"][data-artist="${artist}"]`
    return document.querySelector(selector)
  },

  setTrackLink: function(track, isLast, spotifyChoice) {
    const query = `${this.stripPunctuation(track.title)} ${track.artist}`
    const url = this.getSpotifyTrackSearchUrl(query)

    $.getJSON(url, (data) => {
      if (data && data.info && data.info.num_results > 0) {
        const spotifyUrl = data.tracks[0].href
        const webUrl = this.getSpotifyTrackWebUrl(spotifyUrl)
        const listItem = this.getTrackListItem(track)

        const spotifyLink = document.createElement('a')
        spotifyLink.href = webUrl
        spotifyLink.setAttribute('data-spotify', spotifyUrl)
        spotifyLink.className = 'track-link'
        spotifyLink.addEventListener('click', function(event) {
          event.preventDefault()
          if (spotifyChoice === 'desktop_application') {
            chrome.tabs.create({ url: spotifyUrl })
          } else {
            chrome.tabs.create({ url: webUrl })
          }
        })

        const clone = listItem.cloneNode(true)
        console.log('clone', clone)
        console.log('children', clone.childNodes)
        for (const child of clone.childNodes) {
          spotifyLink.appendChild(child)
        }
        listItem.appendChild(spotifyLink)
      }
      if (isLast) {
        this.setTracksetLink(spotifyChoice)
      }
    })
  },

  setSpotifyLinks: function(tracks, spotifyChoice) {
    const link = document.getElementById('trackset-link')
    link.removeEventListener('click', this.onTracksetLinkClick)
    link.classList.add('hidden')

    const numTracks = tracks.length
    for (let i = 0; i < numTracks; i++) {
      this.setTrackLink(tracks[i], i == numTracks - 1, spotifyChoice)
    }
  },

  stripQuotes: function(str) {
    return str.replace(/"/, "'")
  },

  populateTrackList: function(tracks) {
    const trackList = document.getElementById('track-list')
    while (trackList.hasChildNodes()) {
      trackList.removeChild(trackList.lastChild)
    }

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]
      const li = document.createElement('li')

      const titleSpan = document.createElement('span')
      titleSpan.className = 'title'
      titleSpan.textContent = track.title
      li.appendChild(titleSpan)

      const artistSpan = document.createElement('span')
      artistSpan.className = 'artist'
      artistSpan.textContent = track.artist
      li.appendChild(artistSpan)

      li.setAttribute('data-artist', this.stripQuotes(track.artist))
      li.setAttribute('data-title', this.stripQuotes(track.title))

      trackList.appendChild(li)
    }
  },

  setupOptionsLink: function() {
    const link = document.querySelector('a[href="#options"]')
    link.addEventListener('click', function(event) {
      event.preventDefault()
      chrome.tabs.create({ url: chrome.extension.getURL('options.html') })
    })
  },

  populatePopup: function(tracks) {
    this.populateTrackList(tracks)

    chrome.storage.sync.get('imdb_spotter_options', (opts) => {
      const extensionOpts = opts.imdb_spotter_options || {}
      const spotifyChoice = extensionOpts.spotify || 'web_player'
      this.setSpotifyLinks(tracks, spotifyChoice)
    });
  },

  getArtist: function(songEl) {
    const links = Array.from(songEl.querySelectorAll('a'))
    let artist = links.map((el) => {
      const precedingText = el.previousSibling.nodeValue.trim()
      if (precedingText.indexOf('Performed by') > -1) {
        return el.textContent
      }
    })
    if (artist.length > 0) {
      return artist[0]
    }
    artist = links.map((el) => {
      const precedingText = el.previousSibling.nodeValue.trim()
      if (precedingText.indexOf('Written by') > -1) {
        return el.textContent
      }
      if (precedingText.indexOf('Music by') > -1) {
        return el.textContent
      }
    })
    if (artist.length > 0) {
      return artist[0]
    }
    return ''
  },

  stripPunctuation: function(rawStr) {
    const str = rawStr.replace(/[\[\]\.,-\/#!$%"\^&\*;:{}=\-_`~()']/g, ' ');
    return str.replace(/\s+/g, ' ').trim()
  },

  getImdbSoundtrack: function(imdbID) {
    const url = `http://www.imdb.com/title/${imdbID}/soundtrack`

    const movieLink = document.getElementById('movie-link')
    movieLink.href = url
    movieLink.addEventListener('click', function(event) {
      event.preventDefault()
      chrome.tabs.create({ url: url })
    })

    const trackList = document.getElementById('track-list')
    $.get(url, (data) => {
      const songEls = $('.soundTrack', $(data))
      const tracks = []
      const addedTracks = []

      songEls.forEach((songEl) => {
        const brs = Array.from(songEl.querySelectorAll('br'))
        const title = brs.map((el) => {
          return el.previousSibling.nodeValue
        })[0]
        const artist = this.getArtist(songEl)
        const track = { title: title, artist: artist }
        const trackStr = `${title} ${artist}`
        if (addedTracks.indexOf(trackStr) < 0) {
          tracks.push(track)
          addedTracks.push(trackStr)
        }
      })

      this.populatePopup(tracks)
    })
  },

  onSearch: function() {
    const queryField = document.getElementById('query')
    const query = queryField.value.trim()
    if (query.length < 1) {
      return
    }

    const yearField = document.getElementById('year')
    const year = yearField.value.trim()

    let url = `http://www.omdbapi.com/?t=${encodeURIComponent(query)}`
    if (year.length > 0) {
      url += `&y=${encodeURIComponent(year)}`
    }

    $.getJSON(url, (data) => {
      const wrapper = document.getElementById('movie-details-wrapper')
      if (!data || data.Response === 'False') {
        wrapper.style.display = 'none'
        return
      }

      document.getElementById('movie-title').textContent = data.Title
      document.getElementById('movie-genre').textContent = data.Genre
      document.getElementById('movie-rating').textContent = data.imdbRating
      document.getElementById('movie-year').textContent = data.Year

      const posterEl = document.getElementById('movie-poster')
      if (data.Poster === 'N/A') {
        posterEl.style.display = 'none'
      } else {
        posterEl.src = data.Poster
        posterEl.style.display = 'block'
      }
      this.getImdbSoundtrack(data.imdbID)
      wrapper.style.display = 'block'
    })
  },

  setupSearchForm: function() {
    document.getElementById('submit').addEventListener('click', () => {
      this.onSearch()
    })

    document.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault()
    })

    document.getElementById('query').addEventListener('keypress', (e) => {
      if (e.which === 13) { // Enter
        e.preventDefault()
        this.onSearch()
        return false
      }
    })
  },

  onPopupOpened: function() {
    this.setupOptionsLink()
    this.setupSearchForm()
  }
};

document.addEventListener('DOMContentLoaded', function() {
  chrome.tabs.getSelected(null, function(tab) {
    chrome.tabs.sendRequest(
      tab.id,
      { greeting: 'popup_opened', tab_id: tab.id },
      function() {
        imdbSpotterPopup.onPopupOpened()
      }
    );
  });
});

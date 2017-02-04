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
  getSpotifyTrackSearchUrl(query) {
    return `https://api.spotify.com/v1/search?type=track&q=${encodeURIComponent(query)}`
  },

  getSpotifyTracksetUrl(name, trackIDs) {
    const joinedIDs = trackIDs.join(',')
    return `spotify:trackset:${name}:${joinedIDs}`
  },

  getSpotifyTracksetWebUrl(name, trackIDs) {
    const joinedIDs = trackIDs.join(',')
    return `https://play.spotify.com/trackset/${encodeURIComponent(name)}/${joinedIDs}`
  },

  getSpotifyTrackID(appUrl) {
    return appUrl.split('spotify:track:')[1]
  },

  getSpotifyTrackWebUrl(appUrl) {
    return `https://play.spotify.com/track/${this.getSpotifyTrackID(appUrl)}`
  },

  onTracksetLinkClick(event) {
    event.preventDefault()
    const link = event.target
    let url
    const spotifyChoice = link.getAttribute('data-spotify')
    if (spotifyChoice === 'desktop_application') {
      url = link.getAttribute('data-app-url')
    } else {
      url = link.getAttribute('data-web-url')
    }
    chrome.tabs.create({ url })
  },

  setTracksetLink(spotifyChoice) {
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
    link.setAttribute('data-app-url', tracksetUrl)

    const webUrl = this.getSpotifyTracksetWebUrl(tracksetName, trackIDs)
    link.setAttribute('data-web-url', webUrl)

    link.addEventListener('click', this.onTracksetLinkClick)
    link.style.display = 'block'
  },

  getTrackListItem(track) {
    const title = this.stripQuotes(track.title)
    const artist = this.stripQuotes(track.artist)
    const selector = `#track-list li[data-title="${title}"][data-artist="${artist}"]`
    return document.querySelector(selector)
  },

  setTrackLink(track, isLast, spotifyChoice) {
    const query = `${this.stripPunctuation(track.title)} ${track.artist}`
    const url = this.getSpotifyTrackSearchUrl(query)

    $.getJSON(url, data => {
      if (data && data.info && data.info.num_results > 0) {
        const spotifyUrl = data.tracks[0].href
        const webUrl = this.getSpotifyTrackWebUrl(spotifyUrl)
        const listItem = this.getTrackListItem(track)

        const spotifyLink = document.createElement('a')
        spotifyLink.href = webUrl
        spotifyLink.setAttribute('data-spotify', spotifyUrl)
        spotifyLink.className = 'track-link'
        spotifyLink.addEventListener('click', event => {
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

  setSpotifyLinks(tracks, spotifyChoice) {
    const link = document.getElementById('trackset-link')
    link.removeEventListener('click', this.onTracksetLinkClick)
    link.style.display = 'none'

    const numTracks = tracks.length
    for (let i = 0; i < numTracks; i++) {
      this.setTrackLink(tracks[i], i === numTracks - 1, spotifyChoice)
    }

    this.toggleSearchFormDisabled(false)
  },

  stripQuotes(str) {
    return str.replace(/"/, "'")
  },

  populateTrackList(tracks) {
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

  setupOptionsLink() {
    const link = document.querySelector('a[href="#options"]')
    link.addEventListener('click', event => {
      event.preventDefault()
      const url = chrome.extension.getURL('options.html')
      chrome.tabs.create({ url })
    })
  },

  populatePopup(tracks) {
    console.debug('populatePopup', tracks)
    this.populateTrackList(tracks)

    chrome.storage.sync.get('imdb_spotter_options', opts => {
      const extensionOpts = opts.imdb_spotter_options || {}
      const spotifyChoice = extensionOpts.spotify || 'web_player'
      this.setSpotifyLinks(tracks, spotifyChoice)
    });
  },

  getArtist(songEl) {
    console.debug('getArtist', songEl)
    const links = Array.from(songEl.querySelectorAll('a'))

    let artist = links.map(el => {
      const precedingText = el.previousSibling.nodeValue.trim()
      if (precedingText.indexOf('Performed by') > -1) {
        return el.textContent
      }
      if (precedingText.indexOf('Written and performed by') > -1) {
        return el.textContent
      }
      return ''
    })
    artist = artist.filter(str => str.length > 0)
    if (artist.length > 0) {
      return artist[0]
    }

    artist = links.map(el => {
      const precedingText = el.previousSibling.nodeValue.trim()
      if (precedingText.indexOf('Written by') > -1) {
        return el.textContent
      }
      if (precedingText.indexOf('Music by') > -1) {
        return el.textContent
      }
      if (precedingText.indexOf('Music and lyrics by') > -1) {
        return el.textContent
      }
      return ''
    })
    artist = artist.filter(str => str.length > 0)
    if (artist.length > 0) {
      return artist[0]
    }

    return ''
  },

  stripPunctuation(rawStr) {
    const str = rawStr.replace(/[\[\]\.,-\/#!$%"\^&\*;:{}=\-_`~()']/g, ' ')
    return str.replace(/\s+/g, ' ').trim()
  },

  getImdbSoundtrack(imdbID) {
    const url = `http://www.imdb.com/title/${imdbID}/soundtrack`

    const movieLink = document.getElementById('movie-link')
    movieLink.href = url
    movieLink.addEventListener('click', event => {
      event.preventDefault()
      chrome.tabs.create({ url })
    })

    $.get(url, data => {
      const songEls = $('.soundTrack', $(data))
      const tracks = []
      const addedTracks = []

      for (let i = 0; i < songEls.length; i++) {
        const songEl = songEls[i]
        const brs = Array.from(songEl.querySelectorAll('br'))
        const title = brs.map(el => el.previousSibling.nodeValue)[0]
        const artist = this.getArtist(songEl)
        const track = { title, artist }
        const trackStr = `${title} ${artist}`
        if (addedTracks.indexOf(trackStr) < 0) {
          tracks.push(track)
          addedTracks.push(trackStr)
        }
      }

      this.populatePopup(tracks)
    })
  },

  onImdbResults(data) {
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
  },

  onImdbError(xhr, status, error) {
    console.error('failed to get IMDB results', `status: ${status}, error: ${error}`)
    this.toggleSearchFormDisabled(false)
    const errorEl = document.getElementById('error-message')
    errorEl.textContent = 'Failed to get IMDB movie info.'
    errorEl.style.display = 'block'
  },

  searchImdbByTitle() {
    const title = document.getElementById('query').value.trim()
    if (title.length < 1) {
      return
    }

    const year = document.getElementById('year').value.trim()

    $.ajax({
      url: 'https://www.omdbapi.com',
      jsonp: 'callback',
      dataType: 'jsonp',
      data: { t: title, y: year, r: 'json', plot: 'short' },
      success: data => this.onImdbResults(data),
      error: (xhr, status, error) => this.onImdbError(xhr, status, error)
    })
  },

  toggleSearchFormDisabled(disabled) {
    document.getElementById('submit').disabled = disabled
    document.getElementById('query').disabled = disabled
  },

  onSearchSubmit(event) {
    event.preventDefault()
    const errorEl = document.getElementById('error-message')
    errorEl.textContent = ''
    errorEl.style.display = 'none'
    this.toggleSearchFormDisabled(true)
    this.searchImdbByTitle()
  },

  setupSearchForm() {
    document.getElementById('search-form').addEventListener('submit', e => {
      this.onSearchSubmit(e)
    })

    document.getElementById('query').addEventListener('keypress', e => {
      if (e.which === 13) { // Enter
        this.onSearchSubmit(e)
      }
    })
  },

  populateYearsSelect() {
    const select = document.getElementById('year')
    const currentYear = new Date().getFullYear()
    for (let year = currentYear; year >= 1899; year--) {
      const option = document.createElement('option')
      option.value = year
      option.textContent = year
      select.appendChild(option)
    }
  },

  onPopupOpened() {
    console.debug('popup opened')
    this.populateYearsSelect()
    this.setupOptionsLink()
    this.setupSearchForm()
  }
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.getSelected(null, tab => {
    chrome.tabs.sendRequest(
      tab.id,
      { greeting: 'popup_opened', tab_id: tab.id },
      () => imdbSpotterPopup.onPopupOpened()
    )
  })
})

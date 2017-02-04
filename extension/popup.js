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
    console.debug('getSpotifyTracksetUrl', name, trackIDs)
    const joinedIDs = trackIDs.join(',')
    return `spotify:trackset:${name}:${joinedIDs}`
  },

  getSpotifyTracksetWebUrl(name, trackIDs) {
    const joinedIDs = trackIDs.join(',')
    return `https://play.spotify.com/trackset/${encodeURIComponent(name)}/${joinedIDs}`
  },

  onSpotifyButtonClick(event) {
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

  setTracksetLink(movieTitle, spotifyChoice) {
    const tracksetButton = document.getElementById('trackset-button')
    tracksetButton.setAttribute('data-spotify', spotifyChoice)

    const trackLinks = Array.from(document.querySelectorAll('.track-link'))
    const trackIDs = trackLinks.map(link => link.getAttribute('data-track-id'))

    if (trackIDs.length < 1) {
      document.getElementById('no-spotify-tracks-message').style.display = 'block'
      return
    }

    const tracksetName = movieTitle

    const tracksetUrl = this.getSpotifyTracksetUrl(tracksetName, trackIDs)
    tracksetButton.setAttribute('data-app-url', tracksetUrl)

    const webUrl = this.getSpotifyTracksetWebUrl(tracksetName, trackIDs)
    tracksetButton.setAttribute('data-web-url', webUrl)

    tracksetButton.addEventListener('click', this.onSpotifyButtonClick)
    tracksetButton.style.display = 'inline-flex'
  },

  getTrackListItem(spotifyTrack) {
    console.log('getTrackListItem', spotifyTrack)
    const targetTitle = spotifyTrack.name
    const targetArtists = spotifyTrack.artists.map(artist => artist.name)
    const listItems = Array.from(document.querySelectorAll('#track-list li'))
    for (const listItem of listItems) {
      const title = listItem.querySelector('.track-title').textContent.trim()
      console.log(title, 'versus', targetTitle)
      if (title === targetTitle) {
        const artist = listItem.querySelector('.track-artist').textContent.trim()
        console.log(artist, 'versus', targetArtists)
        if (targetArtists.indexOf(artist) > -1) {
          return listItem
        }
      }
    }
  },

  setTrackLink(movieTitle, track, isLast, spotifyChoice) {
    const query = `${this.stripPunctuation(track.title)} ${track.artist}`
    const url = this.getSpotifyTrackSearchUrl(query)
    console.debug('setTrackLink', url)

    $.getJSON(url, data => {
      console.log(data)
      if (data && data.tracks && data.tracks.total > 0) {
        const track = data.tracks.items[0]
        const listItem = this.getTrackListItem(track)
        if (!listItem) {
          console.error("couldn't find track list item for", track)
          return
        }

        const webUrl = track.external_urls.spotify

        const spotifyLink = document.createElement('a')
        spotifyLink.href = webUrl
        spotifyLink.setAttribute('data-track-id', track.id)
        spotifyLink.className = 'track-link'
        spotifyLink.addEventListener('click', event => {
          event.preventDefault()
          if (spotifyChoice === 'desktop_application') {
            chrome.tabs.create({ url: track.uri })
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
        this.setTracksetLink(movieTitle, spotifyChoice)
      }
    })
  },

  setSpotifyLinks(movieTitle, tracks, spotifyChoice) {
    console.debug('setSpotifyLinks', movieTitle, spotifyChoice, tracks)
    const tracksetButton = document.getElementById('trackset-button')
    tracksetButton.removeEventListener('click', this.onSpotifyButtonClick)
    tracksetButton.style.display = 'none'

    const numTracks = tracks.length
    for (let i = 0; i < numTracks; i++) {
      this.setTrackLink(movieTitle, tracks[i], i === numTracks - 1, spotifyChoice)
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

    if (tracks.length < 1) {
      document.getElementById('no-tracks-message').style.display = 'block'
      return
    }

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]
      const li = document.createElement('li')

      const titleSpan = document.createElement('span')
      titleSpan.className = 'track-title'
      titleSpan.textContent = track.title
      li.appendChild(titleSpan)

      const artistSpan = document.createElement('span')
      artistSpan.className = 'track-artist'
      artistSpan.textContent = track.artist
      li.appendChild(artistSpan)

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

  populatePopup(movieTitle, tracks) {
    console.debug('populatePopup:',
                  tracks.map(t => `${t.title} by ${t.artist}`).join(', '))
    this.populateTrackList(tracks)

    chrome.storage.sync.get('imdb_spotter_options', opts => {
      const extensionOpts = opts.imdb_spotter_options || {}
      const spotifyChoice = extensionOpts.spotify || 'web_player'
      this.setSpotifyLinks(movieTitle, tracks, spotifyChoice)
    });
  },

  getArtist(songEl) {
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
      return artist[0].trim()
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
      return artist[0].trim()
    }

    console.error('could not find artist', songEl)
    return ''
  },

  stripPunctuation(rawStr) {
    const str = rawStr.replace(/[\[\]\.,-\/#!$%"\^&\*;:{}=\-_`~()']/g, ' ')
    return str.replace(/\s+/g, ' ').trim()
  },

  getImdbSoundtrack(movieTitle, imdbID) {
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
        const title = brs.map(el => el.previousSibling.nodeValue)[0].trim()
        const artist = this.getArtist(songEl)
        const track = { title, artist }
        const trackStr = `${title} ${artist}`
        if (addedTracks.indexOf(trackStr) < 0) {
          tracks.push(track)
          addedTracks.push(trackStr)
        }
      }

      this.populatePopup(movieTitle, tracks)
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

    this.getImdbSoundtrack(data.Title, data.imdbID)
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
    document.getElementById('no-tracks-message').style.display = 'none'
    document.getElementById('no-spotify-tracks-message').style.display = 'none'
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

/*
 * Copyright 2017 Sarah Vessels
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

class ImdbSpotterPopup {
  constructor() {
    this.tracksetButton = document.getElementById('trackset-button')
    this.trackList = document.getElementById('track-list')
    this.noSpotifyTracksMessage = document.getElementById('no-spotify-tracks-message')
    this.noTracksMessage = document.getElementById('no-tracks-message')
    this.optionsLink = document.getElementById('options-link')
    this.movieLink = document.getElementById('movie-link')
    this.movieDetailsWrapper = document.getElementById('movie-details-wrapper')
    this.movieTitle = document.getElementById('movie-title')
    this.movieGenre = document.getElementById('movie-genre')
    this.movieRating = document.getElementById('movie-rating')
    this.movieYear = document.getElementById('movie-year')
    this.moviePoster = document.getElementById('movie-poster')
    this.errorEl = document.getElementById('error-message')
    this.queryInput = document.getElementById('query')
    this.yearInput = document.getElementById('year')
    this.submitButton = document.getElementById('submit')
    this.searchForm = document.getElementById('search-form')
  }

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
  }

  enableSpotifyButton(movieTitle, spotifyChoice) {
    this.tracksetButton.setAttribute('data-spotify', spotifyChoice)

    const trackLinks = Array.from(document.querySelectorAll('.track-link'))
    const trackIDs = trackLinks.map(link => link.getAttribute('data-track-id'))

    if (trackIDs.length < 1) {
      this.noSpotifyTracksMessage.style.display = 'block'
      return
    }

    const tracksetName = movieTitle

    const tracksetUrl = SpotifyApi.getTracksetUrl(tracksetName, trackIDs)
    this.tracksetButton.setAttribute('data-app-url', tracksetUrl)

    const webUrl = SpotifyApi.getTracksetWebUrl(tracksetName, trackIDs)
    this.tracksetButton.setAttribute('data-web-url', webUrl)

    this.tracksetButton.addEventListener('click', this.onSpotifyButtonClick)
    this.tracksetButton.style.display = 'inline-flex'
  }

  stripQuotes(str) {
    return str.replace(/"/, "'")
  }

  getSpotifyLink(spotifyTrack, spotifyChoice) {
    const webUrl = spotifyTrack.external_urls.spotify
    const spotifyLink = document.createElement('a')
    spotifyLink.href = webUrl
    spotifyLink.setAttribute('data-track-id', spotifyTrack.id)
    spotifyLink.className = 'track-link'
    spotifyLink.addEventListener('click', event => {
      event.preventDefault()
      if (spotifyChoice === 'desktop_application') {
        chrome.tabs.create({ url: spotifyTrack.uri })
      } else {
        chrome.tabs.create({ url: webUrl })
      }
    })
    return spotifyLink
  }

  getTrackTitleEl(track) {
    const titleSpan = document.createElement('span')
    titleSpan.className = 'track-title'
    titleSpan.textContent = track.title
    return titleSpan
  }

  getTrackArtistEl(track) {
    const artistSpan = document.createElement('span')
    artistSpan.className = 'track-artist'
    artistSpan.textContent = track.artist
    return artistSpan
  }

  populateTrackList(movieTitle, tracks, spotifyChoice) {
    while (this.trackList.hasChildNodes()) {
      this.trackList.removeChild(this.trackList.lastChild)
    }

    if (tracks.length < 1) {
      this.noTracksMessage.style.display = 'block'
      this.toggleSearchFormDisabled(false)
      return
    }

    const promises = []

    for (const track of tracks) {
      const promise = SpotifyApi.getTrack(track).then(data => {
        const li = document.createElement('li')
        const titleSpan = this.getTrackTitleEl(track)
        let artistSpan = null
        if (track.artist && track.artist.length > 0) {
          artistSpan = this.getTrackArtistEl(track)
        }

        if (data && data.tracks && data.tracks.total > 0) {
          const spotifyLink = this.getSpotifyLink(data.tracks.items[0], spotifyChoice)
          spotifyLink.appendChild(titleSpan)
          if (artistSpan) {
            spotifyLink.appendChild(artistSpan)
          }
          li.appendChild(spotifyLink)
        } else {
          li.appendChild(titleSpan)
          if (artistSpan) {
            li.appendChild(artistSpan)
          }
        }

        this.trackList.appendChild(li)
      })
      promises.push(promise)
    }

    $.when.apply($, promises).then(() => {
      console.debug('finished fetching Spotify data')
      this.toggleSearchFormDisabled(false)
      this.enableSpotifyButton(movieTitle, spotifyChoice)
    })
  }

  setupOptionsLink() {
    this.optionsLink.addEventListener('click', event => {
      event.preventDefault()
      const url = chrome.extension.getURL('options.html')
      chrome.tabs.create({ url })
    })
  }

  populatePopup(movieTitle, tracks) {
    console.debug('populatePopup:',
                  tracks.map(t => `${t.title} by ${t.artist}`).join(', '))

    this.tracksetButton.removeEventListener('click', this.onSpotifyButtonClick)
    this.tracksetButton.style.display = 'none'

    chrome.storage.sync.get('imdb_spotter_options', opts => {
      const extensionOpts = opts.imdb_spotter_options || {}
      const spotifyChoice = extensionOpts.spotify || 'web_player'
      this.populateTrackList(movieTitle, tracks, spotifyChoice)
    });
  }

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
      if (precedingText.indexOf('Composed by') > -1) {
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
  }

  getImdbSoundtrack(movieTitle, imdbID) {
    const url = `http://www.imdb.com/title/${imdbID}/soundtrack`

    this.movieLink.href = url
    this.movieLink.addEventListener('click', event => {
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
  }

  onImdbResults(data) {
    if (!data || data.Response === 'False') {
      this.movieDetailsWrapper.style.display = 'none'
      return
    }

    this.movieTitle.textContent = data.Title
    this.movieGenre.textContent = data.Genre
    this.movieRating.textContent = data.imdbRating
    this.movieYear.textContent = data.Year

    if (data.Poster === 'N/A') {
      this.moviePoster.style.display = 'none'
    } else {
      this.moviePoster.src = data.Poster
      this.moviePoster.style.display = 'block'
    }

    this.getImdbSoundtrack(data.Title, data.imdbID)
    this.movieDetailsWrapper.style.display = 'block'
  }

  onImdbError(xhr, status, error) {
    console.error('failed to get IMDB results', `status: ${status}, error: ${error}`)
    this.toggleSearchFormDisabled(false)
    this.errorEl.textContent = 'Failed to get IMDB movie info.'
    this.errorEl.style.display = 'block'
  }

  searchImdbByTitle() {
    const title = this.queryInput.value.trim()
    if (title.length < 1) {
      return
    }

    const year = this.yearInput.value

    $.ajax({
      url: 'https://www.omdbapi.com',
      jsonp: 'callback',
      dataType: 'jsonp',
      data: { t: title, y: year, r: 'json', plot: 'short' },
      success: data => this.onImdbResults(data),
      error: (xhr, status, error) => this.onImdbError(xhr, status, error)
    })
  }

  toggleSearchFormDisabled(disabled) {
    this.submitButton.disabled = disabled
    this.queryInput.disabled = disabled
    this.yearInput.disabled = disabled
  }

  loadFormData() {
    const query = ImdbLocalStorage.get('query')
    if (query && query.length > 0) {
      this.queryInput.value = query
    }

    const year = ImdbLocalStorage.get('year')
    if (year && year.length > 0) {
      const select = this.yearInput
      const option = select.querySelector(`option[value="${year}"]`)
      if (option) {
        option.selected = 'selected'
      }
    }
  }

  saveFormData() {
    const query = this.queryInput.value.trim()
    const year = this.yearInput.value
    ImdbLocalStorage.set('query', query)
    ImdbLocalStorage.set('year', year)
  }

  onSearchSubmit(event) {
    event.preventDefault()
    this.errorEl.textContent = ''
    this.errorEl.style.display = 'none'
    this.noTracksMessage.style.display = 'none'
    this.noSpotifyTracksMessage.style.display = 'none'
    this.toggleSearchFormDisabled(true)
    this.saveFormData()
    this.searchImdbByTitle()
  }

  setupSearchForm() {
    this.searchForm.addEventListener('submit', e => {
      this.onSearchSubmit(e)
    })

    this.queryInput.addEventListener('keypress', e => {
      if (e.which === 13) { // Enter
        this.onSearchSubmit(e)
      }
    })
  }

  populateYearsSelect() {
    const select = this.yearInput
    const currentYear = new Date().getFullYear()
    for (let year = currentYear; year >= 1899; year--) {
      const option = document.createElement('option')
      option.value = year
      option.textContent = year
      select.appendChild(option)
    }
  }

  onPopupOpened() {
    console.debug('popup opened')
    this.populateYearsSelect()
    this.loadFormData()
    this.setupOptionsLink()
    this.setupSearchForm()
  }
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.getSelected(null, tab => {
    chrome.tabs.sendRequest(
      tab.id,
      { greeting: 'popup_opened', tab_id: tab.id },
      () => {
        const popup = new ImdbSpotterPopup()
        popup.onPopupOpened()
      }
    )
  })
})

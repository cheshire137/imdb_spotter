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

function afterContentChanged() {
  document.documentElement.style.boxSizing = 'initial'
  setTimeout(() => {
    document.documentElement.style.boxSizing = 'border-box'
  }, 50)
}

class ImdbSpotterPopup {
  constructor() {
    this.artistPrefixes = ['Performed by', 'Written and performed by', 'Written by',
                           'Music by', 'Composed by', 'Music and lyrics by']
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

    let foundImage = false
    if (spotifyTrack.album && spotifyTrack.album.images &&
        spotifyTrack.album.images.length > 0) {
      const image = spotifyTrack.album.images.filter(img => img.width < 100)[0]
      if (image) {
        const icon = document.createElement('img')
        icon.src = image.url
        icon.className = 'track-image'
        spotifyLink.appendChild(icon)
        foundImage = true
      }
    }

    if (!foundImage) {
      const iconPlaceholder = document.createElement('span')
      iconPlaceholder.className = 'track-icon-placeholder'
      spotifyLink.appendChild(iconPlaceholder)
    }

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
          const iconPlaceholder = document.createElement('span')
          iconPlaceholder.className = 'track-icon-placeholder'
          li.appendChild(iconPlaceholder)
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
      afterContentChanged()
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

  getArtistFromText(lines) {
    for (const prefix of this.artistPrefixes) {
      for (const line of lines) {
        const target = `${prefix} `
        if (line.indexOf(target) > -1) {
          return line.split(target)[1].trim()
        }
      }
    }

    console.error('could not find artist', lines)
    return ''
  }

  getArtist(songEl, brs) {
    const links = Array.from(songEl.querySelectorAll('a'))

    if (links.length < 1) {
      const lines = brs.map(el => el.previousSibling.nodeValue)
      return this.getArtistFromText(lines)
    }

    for (const prefix of this.artistPrefixes) {
      for (const link of links) {
        const precedingText = link.previousSibling.nodeValue.trim()
        if (precedingText.indexOf(prefix) > -1) {
          const artist = link.textContent.trim()
          if (artist.length > 0) {
            return artist
          }
        }
      }
    }

    console.error('could not find artist', songEl)
    return ''
  }

  getImdbSoundtrack(movieTitle, imdbID) {
    const url = `http://www.imdb.com/title/${imdbID}/soundtrack`
    ImdbLocalStorage.set('imdb-url', url)
    this.movieLink.href = url

    $.get(url, data => {
      const songEls = $('.soundTrack', $(data))
      const tracks = []
      const addedTracks = []

      for (let i = 0; i < songEls.length; i++) {
        const songEl = songEls[i]
        const brs = Array.from(songEl.querySelectorAll('br'))
        const title = brs.map(el => el.previousSibling.nodeValue)[0].trim()
        const artist = this.getArtist(songEl, brs)
        const track = { title, artist }
        const trackStr = `${title} ${artist}`
        if (addedTracks.indexOf(trackStr) < 0) {
          tracks.push(track)
          addedTracks.push(trackStr)
        }
      }

      ImdbLocalStorage.set('imdb-tracks', tracks)
      this.populatePopup(movieTitle, tracks)
    })
  }

  onImdbResults(data) {
    if (!data || data.Response === 'False') {
      this.movieDetailsWrapper.style.display = 'none'
      return
    }

    this.saveImdbData(data)

    this.movieTitle.textContent = data.Title
    this.movieGenre.textContent = data.Genre
    this.movieRating.textContent = data.imdbRating
    this.movieYear.textContent = data.Year

    if (data.Poster !== 'N/A') {
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

  loadImdbData() {
    const title = ImdbLocalStorage.get('movie-title')
    if (title) {
      this.movieTitle.textContent = title
    }

    const genre = ImdbLocalStorage.get('movie-genre')
    if (genre) {
      this.movieGenre.textContent = genre
    }

    const rating = ImdbLocalStorage.get('movie-rating')
    if (rating) {
      this.movieRating.textContent = rating
    }

    const year = ImdbLocalStorage.get('movie-year')
    if (year) {
      this.movieYear.textContent = year
    }

    const poster = ImdbLocalStorage.get('movie-poster')
    if (poster) {
      this.moviePoster.src = poster
      this.moviePoster.style.display = 'block'
    }

    const url = ImdbLocalStorage.get('imdb-url')
    if (url) {
      this.movieLink.href = url
    }

    if (title && url) {
      this.movieDetailsWrapper.style.display = 'block'
    }
  }

  clearImdbData() {
    ImdbLocalStorage.delete('movie-title')
    ImdbLocalStorage.delete('movie-genre')
    ImdbLocalStorage.delete('movie-rating')
    ImdbLocalStorage.delete('movie-year')
    ImdbLocalStorage.delete('movie-poster')
    ImdbLocalStorage.delete('imdb-tracks')
    ImdbLocalStorage.delete('imdb-url')
  }

  saveImdbData(data) {
    ImdbLocalStorage.set('movie-title', data.Title)
    ImdbLocalStorage.set('movie-genre', data.Genre)
    ImdbLocalStorage.set('movie-rating', data.imdbRating)
    ImdbLocalStorage.set('movie-year', data.Year)
    if (data.Poster !== 'N/A') {
      ImdbLocalStorage.set('movie-poster', data.Poster)
    }
  }

  loadImdbTracks() {
    const title = ImdbLocalStorage.get('movie-title')
    const tracks = ImdbLocalStorage.get('imdb-tracks')
    if (title && tracks) {
      this.populatePopup(title, tracks)
    }
  }

  onSearchSubmit(event) {
    event.preventDefault()
    this.errorEl.textContent = ''
    this.errorEl.style.display = 'none'
    this.noTracksMessage.style.display = 'none'
    this.noSpotifyTracksMessage.style.display = 'none'
    this.toggleSearchFormDisabled(true)
    this.saveFormData()
    this.clearImdbData()
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

  setupMovieLink() {
    this.movieLink.addEventListener('click', event => {
      event.preventDefault()
      chrome.tabs.create({ url: this.movieLink.href })
    })
  }

  onPopupOpened() {
    console.debug('popup opened')
    this.populateYearsSelect()
    this.loadFormData()
    this.loadImdbData()
    this.loadImdbTracks()
    this.setupOptionsLink()
    this.setupMovieLink()
    this.setupSearchForm()
    afterContentChanged()
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

window.setTimeout(afterContentChanged, 150)

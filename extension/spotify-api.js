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

class SpotifyApi {
  static getTracksetUrl(name, trackIDs) {
    console.debug('getTracksetUrl', name, trackIDs)
    const joinedIDs = trackIDs.join(',')
    return `spotify:trackset:${name}:${joinedIDs}`
  }

  static getTracksetWebUrl(name, trackIDs) {
    const joinedIDs = trackIDs.join(',')
    return `https://play.spotify.com/trackset/${encodeURIComponent(name)}/${joinedIDs}`
  }

  static filterTracksByArtist(spotifyTracks, targetArtist) {
    return spotifyTracks.filter(spotifyTrack => {
      const artists = spotifyTrack.artists.map(artist => artist.name)
      return artists.indexOf(targetArtist) > 0
    })
  }

  static getBestTrackMatch(spotifyTracks, targetTitle, targetArtist) {
    const exactTitleMatches = spotifyTracks.filter(t => t.name === targetTitle)
    if (exactTitleMatches.length > 0) {
      console.log('found', exactTitleMatches.length, 'track(s) with title', targetTitle)
      const exactArtistMatches = this.filterTracksByArtist(exactTitleMatches, targetArtist)
      if (exactArtistMatches.length > 0) {
        console.log('found', exactArtistMatches.length, 'track(s) with title',
                    targetTitle, 'and artist', targetArtist)
        return exactArtistMatches[0]
      }
      return exactTitleMatches[0]
    }
    const exactArtistMatches = this.filterTracksByArtist(spotifyTracks, targetArtist)
    if (exactArtistMatches.length > 0) {
      console.log('found', exactArtistMatches.length, 'track(s) with artist', targetArtist)
      return exactArtistMatches[0]
    }
    console.log('did not find any tracks with target title and artist', targetTitle, targetArtist)
    return spotifyTracks[0]
  }

  static getTrackForQuery(query, targetTitle, targetArtist) {
    console.log('getTrackForQuery', query)
    const url = `https://api.spotify.com/v1/search?type=track&q=${encodeURIComponent(query)}`
    const dfd = $.Deferred()
    $.getJSON(url).then(data => {
      if (data && data.tracks && data.tracks.total > 0) {
        const spotifyTrack = this.getBestTrackMatch(data.tracks.items, targetTitle, targetArtist)
        console.log('Spotify track', spotifyTrack)
        dfd.resolve(spotifyTrack)
      } else {
        console.debug('did not find', `${track.title} by ${track.artist}`, 'with',
                      query)
        dfd.reject()
      }
    })
    return dfd.promise()
  }

  static getTrack(track) {
    const title = track.title
    const artist = track.artist
    let query = `${this.stripPunctuation(title)} ${artist}`
    const dfd = $.Deferred()
    this.getTrackForQuery(query, title, artist).then(spotifyTrack => {
      dfd.resolve(spotifyTrack)
    }, () => {
      console.log('trying a different query')
      const cleanTitle = this.removeParenthesedContent(title)
      query = `${this.stripPunctuation(cleanTitle)} ${artist}`
      this.getTrackForQuery(query, title, artist).then(spotifyTrack => {
        dfd.resolve(spotifyTrack)
      }, () => {
        console.debug('could not find Spotify track', title, artist)
        dfd.resolve(null)
      })
    })
    return dfd.promise()
  }

  static stripPunctuation(rawStr) {
    const str = rawStr.replace(/[\[\]\.,-\/#!$%"\^&\*;:{}=\-_`~()']/g, ' ')
    return str.replace(/\s+/g, ' ').trim()
  }

  static removeParenthesedContent(rawStr) {
    const openIndex = rawStr.indexOf('(')
    if (openIndex < 0) {
      return rawStr
    }
    const prefix = rawStr.slice(0, openIndex).trim()
    const closeIndex = rawStr.indexOf(')', openIndex)
    if (closeIndex < 0) {
      return prefix
    }
    const suffix = rawStr.slice(closeIndex + 1)
    return prefix.concat(suffix)
  }
}

window.SpotifyApi = SpotifyApi

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
  static getSpotifyTrackSearchUrl(query) {
    return `https://api.spotify.com/v1/search?type=track&q=${encodeURIComponent(query)}`
  }

  static getSpotifyTracksetUrl(name, trackIDs) {
    console.debug('getSpotifyTracksetUrl', name, trackIDs)
    const joinedIDs = trackIDs.join(',')
    return `spotify:trackset:${name}:${joinedIDs}`
  }

  static getSpotifyTracksetWebUrl(name, trackIDs) {
    const joinedIDs = trackIDs.join(',')
    return `https://play.spotify.com/trackset/${encodeURIComponent(name)}/${joinedIDs}`
  }

  static getSpotifyTrack(track) {
    const query = `${this.stripPunctuation(track.title)} ${track.artist}`
    const url = SpotifyApi.getSpotifyTrackSearchUrl(query)
    console.debug('getSpotifyTrack', url)
    return $.getJSON(url)
  }

  static stripPunctuation(rawStr) {
    const str = rawStr.replace(/[\[\]\.,-\/#!$%"\^&\*;:{}=\-_`~()']/g, ' ')
    return str.replace(/\s+/g, ' ').trim()
  }
}

window.SpotifyApi = SpotifyApi

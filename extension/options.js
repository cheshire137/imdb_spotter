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

function saveOptions(event) {
  console.log('saveOptions', event.target)
  const input = document.querySelector('input[name="spotify"]:checked')
  const spotify = input.value
  const statusArea = document.getElementById('status-message')
  const options = { spotify: spotify }

  chrome.storage.sync.set({'imdb_spotter_options': options}, function() {
    statusArea.textContent = 'Okay, got it!'
    $(statusArea).fadeIn(function() {
      setTimeout(() => $(statusArea).fadeOut(), 2000)
    })
  })
}

function restoreOptions() {
  chrome.storage.sync.get('imdb_spotter_options', function(opts) {
    const extensionOpts = opts.imdb_spotter_options || {}

    if (extensionOpts.spotify) {
      const selector = `input[name="spotify"][value="${extensionOpts.spotify}"]`
      const input = document.querySelector(selector)
      input.checked = true
    } else {
      const player = document.getElementById('web_player')
      player.checked = true
    }
  })
}

document.addEventListener('DOMContentLoaded', restoreOptions)

const spotifyInput = document.querySelector('input[name="spotify"]')
spotifyInput.addEventListener('change', saveOptions)

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

const optionsKey = 'imdb_spotter_options'

function saveOptions(event) {
  const spotifyChoice = event.target.value
  const extensionOpts = { spotify: spotifyChoice }
  const opts = {}
  opts[optionsKey] = extensionOpts

  chrome.storage.sync.set(opts, function() {
    const statusArea = document.getElementById('status-message')
    statusArea.textContent = 'Okay, got it!'
    $(statusArea).fadeIn(function() {
      setTimeout(() => $(statusArea).fadeOut(), 2000)
    })
  })
}

function restoreSpotifyOption(extensionOpts) {
  const spotifyChoice = extensionOpts.spotify
  let input
  if (spotifyChoice) {
    const selector = `input[name="spotify"][value="${spotifyChoice}"]`
    input = document.querySelector(selector)
  } else {
    input = document.getElementById('web_player')
  }
  input.checked = true
}

function restoreOptions() {
  chrome.storage.sync.get(optionsKey, function(opts) {
    const extensionOpts = opts.imdb_spotter_options || {}
    restoreSpotifyOption(extensionOpts)
  })
}

document.addEventListener('DOMContentLoaded', restoreOptions)

const spotifyInputs = Array.from(document.querySelectorAll('input[name="spotify"]'))
for (const spotifyInput of spotifyInputs) {
  spotifyInput.addEventListener('change', saveOptions)
}

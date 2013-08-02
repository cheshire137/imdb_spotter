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

var imdb_spotter = {
  on_popup_opened: function(tab_id, callback) {
    console.log('imdb spotter popup opened');
  }
};

chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
  if (request.greeting == 'popup_opened') {
    imdb_spotter.on_popup_opened(request.tab_id, function() {
      sendResponse();
    });
  }
});

/*
Copyright 2020 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

  https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/* globals ga YT */

const form = document.getElementById('search');
// const DATALISTS_FILE = 'data/datalists.json';
const IFRAME_ID = 'youtube';
const iframe = document.getElementById(IFRAME_ID);
const infoElement = document.getElementById('info');
const matchesList = document.getElementById('matches');
const queryInfoElement = document.getElementById('query-info');
const queryInput = document.getElementById('query');
// const speakerInput = document.getElementById('speaker');
// const speakersDatalist = document.getElementById('speakers');
// const titleInput = document.getElementById('title');
// const titlesDatalist = document.getElementById('titles');
const topSection = document.getElementById('top');
const transcriptDiv = document.getElementById('transcript');

let captionSpans;
let currentSpan = null;
let currentVideo;
// let datalists;
let player;
let pollingTimerId;
let startTime;
// let videoTitles;

const baseUrl = `${window.location.origin}${window.location.pathname}`;

// Interval between checks when transcript focus follows video playback.
const POLLING_INTERVAL = 100;

const TRANSCRIPT_DIR = 'transcripts';

const QUERY_INPUT_PLACEHOLDER = 'Search for a word or phrase';

// For Google Analytics
// const SEARCH_QUERY_PAGE_LOCATION = `https://glitch.com/#!/sqlite-search/search?q=`;
// const SEARCH_QUERY_PAGE_PATH = `/search?q=`;

const captionScrollCheckbox = document.getElementById('captionScroll');
captionScrollCheckbox.checked = localStorage.captionScroll === 'true';
captionScrollCheckbox.onchange = (event) => {
  localStorage.captionScroll = event.target.checked;
};
// If the user scrolls manually, turn off automatic scrolling.
window.onwheel = window.ontouchmove = () => {
  captionScrollCheckbox.checked = false;
};

// Select whether the top section (search, video and page options) should be
// sticky. Otherwise it scrolls with the page. The initial state is `sticky`.
const videoStickyCheckbox = document.getElementById('videoSticky');
// Check the video checkbox unless it's previously been unchecked.
// In other words, the default state is checked/sticky.
videoStickyCheckbox.checked =
    localStorage.videoSticky === 'false' ? false : true;

videoStickyCheckbox.onchange = (event) => {
  // TODO: change to use class
  topSection.style.position = event.target.checked ? 'sticky' : 'unset';
  localStorage.videoSticky = event.target.checked;
};

// Get the YouTube API script.
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// Respond to URL pop.
window.onpopstate = handleUrlParams;

// A hash value is a search query, video ID, or video ID and time (s or mm:ss)
// For example: /?q=brazen, /?v=AB9qSUhlxh8, /?v=AB9qSUhlxh8&t=1:41
// window.setTimeout(checkForUrlParams, 100);
checkForUrlParams();

// Get and parse data for video titles and speaker names from datalists.json.
// Run here to ensure that (for performance) index data is retrieved first.
// window.setTimeout(fetchDatalists, 100);

// When the video starts playing, start polling (to focus the current caption).
// Stop polling when video is paused or ended.
function handlePlayerStateChange(event) {
  // console.log('>>> handlePlayerStateChange', event.data);
  if (event.data === YT.PlayerState.PLAYING) {
    startPolling();
  } else if (event.data === YT.PlayerState.PAUSED ||
      event.data === YT.PlayerState.ENDED) {
    stopPolling();
  }
}

// Set the current time of the video when you tap/click on a caption.
function addCaptionSpanHandlers() {
  captionSpans = document.querySelectorAll('span[data-start]');
  for (const span of captionSpans) {
    span.onclick = () => {
      if (currentSpan) {
        currentSpan.classList.remove('current');
      }
      currentSpan = span;
      span.classList.add('current');
      const start = span.getAttribute('data-start');
      // Used to not work without rounded number :/...
      player.seekTo(Math.round(start));
      // Will not work until user has manually initiated playback.
      player.playVideo();
      const state = {type: 'caption', v: currentVideo, t: start};
      const title = `web.dev LIVE: ${currentVideo}, ${start}`;
      const url = `${baseUrl}?v=${currentVideo}&t=${start}`;
      history.pushState(state, title, url);
      document.title = title;
    };
  }
}

function startPolling() {
  pollingTimerId = setInterval(focusCaption, POLLING_INTERVAL);
}

function stopPolling() {
  clearInterval(pollingTimerId);
}

// Set visual focus on the current caption.
function focusCaption() {
  const currentTime = player.getCurrentTime();
  if (currentSpan) {
    currentSpan.classList.remove('current');
  }
  for (const span of captionSpans) {
    // Find currentSpan — could be optimized.
    if (span.dataset.start < currentTime && span.dataset.end > currentTime) {
      span.classList.add('current');
      currentSpan = span;
      if (captionScrollCheckbox.checked) {
        ensureVisible(span);
      }
      break;
    }
  }
}

// If necessary, scroll the current span into view.
function ensureVisible(span) {
  // If videoStickyCheckbox is checked, it's necessary to account for
  // the height of section#top
  // topSectionHeight depends on the size of the viewport.
  // if (inView(span)) {
  //   return;
  // }
  // TODO: MVC rather than saving state in UI.
  // if (videoStickyCheckbox.checked) {
  span.scrollIntoView({behavior: 'smooth', block: 'center'});
  // span.scrollIntoView({block: 'start'});
  // // 40 is magic number to cope with margins.
  // scrollBy(0, -(topSection.offsetHeight + 40));
  // } else {
  //   span.scrollIntoView({block: 'center'});
  // }
}

// Check if an element, such as a caption span, is in view.
// function inView(element) {
//   const elementRect = element.getBoundingClientRect();
//   const topSectionRect = topSection.getBoundingClientRect();
//   // 40 is magic number to cope with margins.
//   return elementRect.top >= (topSectionRect.bottom + 40) &&
//       elementRect.bottom < document.documentElement.clientHeight;
// }

// Log a Google Analytics event when search options is opened.
// searchOptionsDetails.ontoggle = (event) => {
//   if (event.target.open) {
//     gtag('event', 'Search options opened', {
//       'event_category': 'Search',
//       // 'event_label': 'Search options',
//     });
//   }
// };

// Fetch and parse data for speaker names, etc.
// function fetchDatalists() {
//   // fetch(DATALISTS_FILE).then((response) => {
//   //   return response.json();
//   // }).then((json) => {
//   //   datalists = json;
//   //   for (const speaker of datalists.speakers) {
//   //     const option = document.createElement('option');
//   //     option.value = speaker.n;
//   //     speakersDatalist.appendChild(option);
//   //   }
//   //   videoTitles = datalists.videoTitles;
//   //   const titles = datalists.titles;
//   //   for (const title of titles) {
//   //     const option = document.createElement('option');
//   //     option.value = title;
//   //     titlesDatalist.appendChild(option);
//   //   }
//   //   // NB: handleUrlParams() called in checkForUrlParams()
//   //   // depends on data in DATALISTS_FILE
//   // }).catch((error) => {
//   //   displayInfo('There was a problem downloading data.<br><br>' +
//   //     'Please check that you\'re online or try refreshing the page.');
//   //   console.error(`Error fetching ${DATALISTS_FILE}: ${error}`);
//   // });
// }

// If the location has query params, do a search or load a video or caption.
function checkForUrlParams() {
  if (location.search || location.hash) {
    handleUrlParams();
  }
}

// Parameters mean a search query, video ID, or video ID and time (s or mm:ss)
// For example: /?q=brazen, /?v=AB9qSUhlxh8, /?v=AB9qSUhlxh8&t=1:41
//              /#q=brazen, /#v=AB9qSUhlxh8, /#v=AB9qSUhlxh8&t=1:41
function handleUrlParams() {
  let params;
  if (location.hash) {
    // Construct a URLSearchParams object from the values in the hash fragment.
    const valueArray = location.hash.slice(1).split('&').map((value) => {
      return value.split('=');
    });
    params = new URLSearchParams(valueArray);
  } else if (location.search) {
    params = new URLSearchParams(window.location.search);
  }
  let query = params.get('q');
  const video = params.get('v');
  if (query) {
    // Decode if necessary and replace non-alpha characters with a space
    query = decodeURI(query).replace(/[^\w.]+/g, ' ');
    if (query.length > 1) {
      queryInput.value = query;
    } else {
      queryInput.placeholder = QUERY_INPUT_PLACEHOLDER;
    }
    search(query);
  } else if (video) {
    const time = params.get('t') || '0';
    const location = {
      time: time,
      video: video,
    };
    displayCaption(location);
  }
}

queryInput.oninput = () => {
  // Enable :invalid CSS if input is not empty.
  const value = queryInput.value;
  if (value.length > 0) {
    queryInput.classList.add('validate');
    const state = {type: 'query', value: value};
    const title = `Query: ${value}`;
    const url = `${baseUrl}?q=${value}`;
    history.pushState(state, title, url);
    document.title = `Event search: ${value}`;
  } else {
    queryInput.classList.remove('validate');
  }
};

form.onsubmit = (event) => {
  event.preventDefault();
  search(queryInput.value);
};

function search(query) {
  matchesList.textContent = '';
  startTime = window.performance.now();
  console.time(`Time to do search for '${query}'`);
  fetch(`/search?q=${queryInput.value}`)
    .then((response) => response.json())
    .then((matches) => {
      handleSearchResponse(query, matches);
    }).catch((error) => {
      console.error(`search() error for query ${query}\n`, error);
    });
  doAnalytics(query);
}

function handleSearchResponse(query, matches) {
  // console.log('handleSearchResponse() matches:', matches);
  console.timeEnd(`Time to do search for '${query}'`);
  const elapsed = Math.round(window.performance.now() - startTime) / 1000;
  // When displaying search results, hide the div for displaying transcripts.
  hide(transcriptDiv);
  // Show search results, i.e. matches.
  show(matchesList);

  // sort by video title: doc.t is title
  // matches = matches.sort((a, b) => {
  //   return a.doc.t.localeCompare(b.doc.t);
  // });

  // prefer exact matches
  // matches = matches.sort((a, b) => {
  //   if (a.doc.t.includes(query) && b.doc.t.includes(query)) {
  //     return 0;
  //   } else if (a.doc.t.includes(query)) {
  //     return -1;
  //   } else if (b.doc.t.includes(query)) {
  //     return 1;
  //   } else {
  //     return 0;
  //   }
  // });

  // Scroll back to top in case user has scrolled down.
  // window.scroll(0, 0);
  const message = `Found ${matches.length} match(es) in ${elapsed} seconds`;
  displayInfo(message);
  queryInfoElement.textContent = 'Click on a match to view video';
  displayMatches(matches);
}

// Filter matches, if displayed.
// titleInput.oninput = speakerInput.oninput = genderInput.oninput = () => {
//   if (matches && matches.length > 0) {
//     displayMatches();
//   }
// };

// const typeCheckboxes = document.querySelectorAll('div#type input');
// for (const typeCheckbox of typeCheckboxes) {
//   typeCheckbox.onchange = () => {
//     speakerInput.disabled = genderInput.disabled =
//       !typePlayCheckbox.checked;
//     if (matches && matches.length > 0) {
//       displayMatches();
//     }
//   };
// }

// Display a list of matched captions
function displayMatches(matches) {
  hide(iframe);
  hide(infoElement);
  hide(matchesList);
  matchesList.textContent = '';
  hide(queryInfoElement);
  hide(transcriptDiv);
  const filteredMatches = getFilteredMatches(matches);
  if (filteredMatches.length > 0) {
    show(infoElement);
    show(matchesList);
    show(queryInfoElement);
    // const exactPhrase = new RegExp(`\b${query}\b`, 'i');
    // keep exact matches only
    // matches = matches.filter(function(match) {
    //   return exactPhrase.test(match.doc.text);
    // });
    //
    for (const match of filteredMatches) {
      addMatch(match);
    }
  } else {
    displayInfo('No matches :^\\');
    queryInfoElement.textContent = '';
  }
}

// Filter matches on client.
// TODO: for a backend database, do this in the query.
function getFilteredMatches(matches) {
  const filteredMatches = matches;

  // if a speaker is specified, filter out non-matches
  // if (speakerInput.value) {
  //   filteredMatches = matches.filter((match) => {
  //     return match.speaker &&
  //       match.speaker.toLowerCase().includes(speakerInput.value.toLowerCase());
  //   });
  // }

  // if a title is specified, filter out non-matches
  // if (titleInput.value) {
  //   filteredMatches = filteredMatches.filter((match) => {
  // ...
  //   });
  // }

  //  const message = `Found ${filteredMatches.length} match(es)`;
  //  displayInfo(message);
  return filteredMatches;
}

// Add an individual match element to the list of matches
function addMatch(match) {
  const matchElement = document.createElement('li');
  // matchElement.dataset.speaker = match.speaker;
  matchElement.dataset.start = match.time;
  matchElement.dataset.video = match.video;
  matchElement.textContent = match.text;
  matchElement.title = `${match.video}, ${match.time}`;
  matchElement.onclick = () => {
    const state = {type: 'caption', video: match.video, time: match.time};
    const title = `Caption: ${match.video, match.time}`;
    const url = `${baseUrl}?v=${match.video}&t=${match.time}`;
    history.pushState(state, title, url);
    document.title = title;
    displayCaption(match);
  };
  matchesList.appendChild(matchElement);
}


// Display the appropriate video and caption when a user taps/clicks on a match
// or opens a URL with a video and (optionally) a time parameter
function displayCaption(match) {
  // hide(creditElement);
  hide(infoElement);
  hide(matchesList);
  hide(queryInfoElement);
  show(topSection);
  currentVideo = `${match.video}`;
  if (iframe.src === '') {
    iframe.src = `https://www.youtube.com/embed/${match.video}?enablejsapi=1&html5=1` +
        `&start=${match.time}&autoplay=1&mute=1`;
    iframe.onload = () => {
      player = new YT.Player(IFRAME_ID, {
        events: {
          'onStateChange': handlePlayerStateChange,
          'onReady': () => {
            player.time = match.time;
            player.seekTo(Math.round(match.time));
          },
        },
      });
    };
  } else {
    player.loadVideoById({
      videoId: match.video,
      startSeconds: Math.round(match.time),
    });
  }

  show(iframe);
  const transcriptFilepath = `${TRANSCRIPT_DIR}/${match.video}.html`;
  fetch(transcriptFilepath).then((response) => {
    return response.text();
  }).then((html) => {
    transcriptDiv.innerHTML = html;
    addCaptionSpanHandlers();
    // transcriptDiv.onmouseover = addWordSearch;
    show(transcriptDiv);
    // show(creditElement);
    highlightCaption(match.time);
  }).catch((error) => {
    console.error(`Error or timeout fetching ${transcriptFilepath}: ${error}`);
    displayInfo(`There was a problem downloading the transcript for ` +
      `<em>${transcriptFilepath}.</em><br><br>` +
      'Check that you\'re online, or try refreshing the page.<br><br>' +
      'You can download transcripts when you\'re online by selecting the ' +
      '<strong>Download all</strong> checkboxes from ' +
      '<strong>Search options</strong>.');
  });
}

// Highlight a caption within a video, given a time.
// For example: /#AB9qSUhlxh8?t=1:41
// function highlightTime(time) {
// find line
// add highlight
// scroll into view
// }

// Highlight a caption, given a start time, and make sure it's visible.
// Caption start times in transcripts are in seconds with three decimal places.
// This function needs to make sense of times requested via tap/click on
// search results as well as values from URLs.
function highlightCaption(startTime) {
  // Normal case: will work for exact matches (as when clicking search results)
  // and for URLs where the time is in seconds and matches the integer part
  // of a caption's start time.
  const captionSpan = document.querySelector(`span[data-start^="${startTime}"]`);
  // If found, i.e. no problem, then highlight the current caption.
  if (captionSpan) {
    captionSpan.classList.add('current');
    ensureVisible(captionSpan);
  } else if (startTime < 0 || startTime >= 86400) {
    // If attempting to set a time (from a URL) that's negative or longer than one day.
    highlightCaption(0);
  } else if (!captionSpan && startTime > 1) {
    // For example, when trying to set a startTime that doesn't correspond to
    // the integer part of a caption span's data-start property.
    // Just keep trying one second earlier. Hacky, but works well enough.
    highlightCaption(startTime - 1);
  }
}

// Highlight a caption
// function highlightCaption(parent, selector, elementIndex) {
//   const element = parent.querySelectorAll(selector)[elementIndex];
//   element.classList.add('highlight');
//   element.scrollIntoView({block: 'center'});
// }


// Service Worker functions (using Workbox)

// function registerServiceWorker() {
//   if ('serviceWorker' in navigator) {
//   // Use the window load event to keep the page load performant.
//     navigator.serviceWorker.register('./sw.js');
//   } else {
//     displayInfo('This browser cant\'t store downloaded files.<br><br>' +
//       'The app will work, but only when you\'re online.');
//     console.error('Service worker not supported');
//   }
// }

function doAnalytics(query) {
  // Add Google Analytics tracking for searches.
  ga('send', 'pageview', `/search?q=${query}`);

  // gtag('config', 'UA-174913118-1', {
  //   'page_title': 'search',
  //   'page_location': `${SEARCH_QUERY_PAGE_LOCATION}${query}`,
  //   'page_path': `${SEARCH_QUERY_PAGE_PATH}${query}`,
  // });
}

// Utility functions

// From https://gist.github.com/davej/728b20518632d97eef1e5a13bf0d05c7
// function fetchWithTimeout(url, options, timeout = 5000) {
//   return Promise.race([fetch(url, options),
//     new Promise((_, reject) =>
//       setTimeout(() => reject(new Error('Timeout')), timeout))]);
// }

// Display information to the user.
function displayInfo(html) {
  infoElement.innerHTML = html;
  show(infoElement);
}

function hide(element) {
  element.classList.add('hidden');
}

function show(element) {
  element.classList.remove('hidden');
}

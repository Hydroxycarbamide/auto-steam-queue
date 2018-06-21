// ==UserScript==
// @name            Auto Steam Discovery Queue
// @namespace       https://steamcommunity.com/id/zetx/
// @description     Go to next game queued as soon as page is done loading.
// @include         http(s)://store.steampowered.com/*app/*
// @include         http(s)://store.steampowered.com/*explore*
// @include         http(s)://store.steampowered.com/*agecheck/app/*
// @version         4.04
// @run-at          document-end
// @grant           none
// ==/UserScript==

// See README.md for shout-outs <3
/* global $J DoAgeGateSubmit g_sessionID UpdateNotificationCounts */
function auto_steam_queue() {
  const comeBackTomorrow = "Come back tomorrow to earn more cards by browsing your Discovery Queue!";
  const notInRegion = "This item is currently unavailable in your region";

  // var path = window.location.pathname.split('/')[1];
  const path = window.location.pathname.match( /\/([\w]+?)(?:\/|$)/ ).pop();

  // Create a 'control' UI for updates and running arbitrary queues
  const createUI = () => {
    const autoQueueContainerDiv = document.createElement( "div" );
    const autoQueueStatusDiv = document.createElement( "div" );
    const autoQueueControlsDiv = document.createElement( "div" );

    autoQueueContainerDiv.setAttribute( "id", "auto_queue" );
    autoQueueContainerDiv.setAttribute( "class", "discovery_queue_customize_ctn" );
    autoQueueContainerDiv.setAttribute( "style", "margin-top: 12px; margin-bottom: 12px !important;" );

    autoQueueStatusDiv.setAttribute( "id", "auto_queue_status" );
    autoQueueStatusDiv.setAttribute( "style", "display: inline" );

    autoQueueControlsDiv.setAttribute( "id", "auto_queue_controls" );
    autoQueueControlsDiv.setAttribute( "style", "float: right" );

    autoQueueContainerDiv.appendChild( autoQueueStatusDiv );
    autoQueueContainerDiv.appendChild( autoQueueControlsDiv );

    document.getElementsByClassName( "discovery_queue_apps" )[ 0 ].getElementsByTagName( "h2" )[ 0 ].insertAdjacentHTML( "afterend", autoQueueContainerDiv.outerHTML );
  };

    // Add the controls for running arbitrary queues
  const populateControls = () => {
    const controlsContainer = document.getElementById( "auto_queue_controls" );

    const form = document.createElement( "form" );
    const input = document.createElement( "input" );
    const span = document.createElement( "span" );
    const button = document.createElement( "button" );

    form.setAttribute( "id", "auto_queue_form" );
    form.setAttribute( "style", "display: inline" );

    input.setAttribute( "type", "number" );
    input.setAttribute( "min", "1" );
    input.setAttribute( "step", "1" );
    input.setAttribute( "id", "queue_num" );
    input.setAttribute( "placeholder", "# of queues to run" );

    span.textContent = "Run";

    button.setAttribute( "type", "submit" );
    button.setAttribute( "class", "btnv6_blue_hoverfade btn_tiny" );
    button.appendChild( span );

    form.appendChild( input );
    form.appendChild( button );

    controlsContainer.innerHTML = form.outerHTML;

    document.getElementById( "auto_queue_form" ).addEventListener( "submit", completeNumQueues, false );
  };

    // On submit, do numQueues worth of queues
  function completeNumQueues( event ) {
    event.preventDefault();

    const numQueues = document.getElementById( "queue_num" ).value;

    generateAndCompleteQueue( 0, numQueues );
  }

  // Sets status updates for the control UI
  function setStatus( newStatus ) {
    if ( document.getElementById( "auto_queue_status" ) === null ) {
      return;
    }

    document.getElementById( "auto_queue_status" ).textContent = `Queue Status: ${newStatus}`;
  }

  // Tells Steam to generate a new queue then runs through the appids to clear 'em off the queue
  function generateAndCompleteQueue( currentQueueNum, maxQueueNum ) {
    setStatus( `Queue #${++currentQueueNum}` );

    $J.post( "https://store.steampowered.com/explore/generatenewdiscoveryqueue", {
      sessionid: g_sessionID,
      queuetype: 0
    } ).done( ( data ) => {
      const appsCleared = [];

      data.queue.forEach( ( appId ) => {
        appsCleared.push( $J.post( "https://store.steampowered.com/app/60", {
          appid_to_clear_from_queue: appId,
          sessionid: g_sessionID
        } ) );
      } );

      Promise.all( appsCleared ).then( () => {
        if ( currentQueueNum < maxQueueNum ) {
          generateAndCompleteQueue( currentQueueNum, maxQueueNum );
        } else {
          setStatus( `Finished ${currentQueueNum} queue(s).` );
          UpdateNotificationCounts();
        }
      }, ( reason ) => {
        console.log( `Bad: ${reason}` );
      } );
    } );
  }

  // Actions for /explore*
  const explorePageActions = () => {
    if ( document.getElementsByClassName( "discovery_queue_apps" ).length ) {
      createUI();
      populateControls();
    }

    if ( $J( ".discovery_queue_winter_sale_cards_header" ).length ) {
      if ( !$J( `.discovery_queue_winter_sale_cards_header:contains(${comeBackTomorrow})` ).length ) {
        setStatus( "Starting queues..." );
        generateAndCompleteQueue( 0, 3 );
      }
    }

    setStatus( "Waiting..." );
  };

    // Auto-submitted old-style age checks
    // https://store.steampowered.com/agecheck/app/*
  const ageCheckPageActions = () => {
    $( "span:contains('Enter')" );
    $J( "#ageYear" ).val( 1915 ).trigger( "change" );
    DoAgeGateSubmit();
  };

    // Actions for /app* including new-style age checks
  const appPageActions = () => {
    if ( window.location.pathname.split( "/" )[ 3 ] === "agecheck" ) {
      document.getElementsByClassName( "btn_grey_white_innerfade btn_medium" )[ 0 ].click();
    } else if ( $J( `.error:contains(${notInRegion})` ).length ) {
      const unavailable_app = window.location.pathname.split( "/" )[ 2 ];
      $J.post( "/app/7", {
        sessionid: g_sessionID,
        appid_to_clear_from_queue: unavailable_app
      } ).done( ( data ) => {
        window.location = "https://store.steampowered.com/explore/next";
        $J( ".error" ).html( `${$J( ".error" ).html()}<br />(Removing from queue)` );
      } ).fail( () => {
        $J( ".error" ).html( `${$J( ".error" ).html()}<br />(Could not remove from queue. Reload or try <a href="https://www.reddit.com/r/Steam/comments/3r2k4y/how_do_i_complete_discovery_queue_if_every_queue/cwkrrzf">removing manually.</a>)` );
      } );
    }

    /*
         else if ( $J('#next_in_queue_form').length ) {
             $J('.queue_sub_text').text('Loading next in queue');
             $J('#next_in_queue_form').submit();
         }
         */
  };

  if ( path === "explore" ) {
    explorePageActions();
  } else if ( path === "app" ) {
    appPageActions();
  } else if ( path === "agecheck" ) {
    ageCheckPageActions();
  }
}

addJS_Node( null, null, auto_steam_queue );

// -- This is a standard-ish utility function:
function addJS_Node( text, s_URL, funcToRun, runOnLoad ) {
  const D = document;
  const scriptNode = D.createElement( "script" );
  if ( runOnLoad ) {
    scriptNode.addEventListener( "load", runOnLoad, false );
  }
  scriptNode.type = "text/javascript";
  if ( text ) { scriptNode.textContent = text; }
  if ( s_URL ) { scriptNode.src = s_URL; }
  if ( funcToRun ) { scriptNode.textContent = `(${funcToRun.toString()})()`; }

  const targ = D.getElementsByTagName( "head" )[ 0 ] || D.body || D.documentElement;
  targ.appendChild( scriptNode );
}

// FILL IN THESE VALUES
// for details, see http://sipjs.com/api/0.5.0/ua_configuration_parameters/
var form           = $('.signup-body'),
    apiNodeBaseUrl = '/api/v2/',
    formData       = {},
    token          = null,
    config         = {},
    session,
    fUsername      = form.find('input[name=username]'),
    fPassword      = form.find('input[name=password]');

function logFailure(data) {
  console.log(data);
}

// Login click handler.
form.find('#log_in')
  .click(function (e) {
    e.preventDefault();
    if (fUsername.isNullOrEmpty() || fPassword.isNullOrEmpty()) {
      showError('Please enter username and password');
    } else {
      formData.username = fUsername.val();
      formData.password = fPassword.val();
      $.ajax({
          type: "POST",
          contentType: "application/json",
          dataType: 'json',
          cache: false,
          url: "/api/v1/users/login",
          data: JSON.stringify(formData)
        })
        .then(getSip, logFailure);
    }
  });

// Get sip information after successfull login
function getSip(data) {
  token = data.token;
  $('#formcontainer')
    .hide();
  $.ajax({
      type: "GET",
      headers: {
        'X-Auth-Token': token
      },
      dataType: 'json',
      cache: false,
      url: "/api/v2/users/sip/",
    })
    .then(onSipData, logFailure);
}

// On getting the sip data register the sip endpoint
function onSipData(data) {
  console.log(data);
  $('#stats')
    .html('Login Successful. You are logged in as :' + data.extension);

  // create config using data from API call
  config = {
    wsServers: data.websocket_proxy,
    uri: data.public_identity,
    password: data.password,
    authorizationUser: data.extension,
    userAgentString: 'SIP.js/0.5.0-devel BAREBONES DEMO',
    traceSip: true,
  };

  // ensure config values are provided
  var requiredParams = ['wsServers', 'uri', 'authorizationUser', 'password'];
  requiredParams.some(function checkParam(param) {
    if (config[param]) {
      return false;
    }

    alert('config.' + param + ' is not set! Please open phone.js and set each of the following:\n\n\t* config.' + requiredParams.join('\n\t* config.'));
    return true;
  });

  // instantiate SIP endpoint passing it the config that was built
  var ua = new SIP.UA(config);

  // attach a handler for incoming call 
  ua.on('invite', handleIncomingCall);
}

// handle incoming call
function handleIncomingCall(s) {
  var text = s.remoteIdentity.uri.toString() + ' is calling you. Accept?';
  // show a confirm box to indicate an incoming call. 
  var accept = confirm(text);
  if (accept) {
    // accept the incoming call
    s.accept(getSessionOptions());
    // setup session by attaching audio stream.
    setupSession(s);
  } else {
    s.reject();
  }
}

// function to invoke api for dialing out to prospect
function dial() {
  if (!$('#target')[0].value) {
    return;
  }
  var number = $('#target')[0].value;
  var prospect = {
    sip: number
  };
  var data = {
    'prospect': prospect
  };

  $.ajax({
      type: "POST",
      headers: {
        'X-Auth-Token': token
      },
      contentType: "application/json",
      dataType: 'json',
      cache: false,
      url: apiNodeBaseUrl + 'call/sf-call',
      data: JSON.stringify(data)
    })
    .then(function (data) {
      console.log(data);
    }, logFailure);
}

// hangup the call by terminating the session 
function endSession() {
  if (session) {
    session.terminate();
  }
}


// support functions for setting up and terminating the session 
function sendDtmf(value) {
  if (session && /[1234567890#*]/.test(value)) {
    session.dtmf(value);
  }
}


function getSessionOptions() {
  return {
    media: {
      audio: true,
      video: false
    }
  };
}
function setupSession(s) {
  endSession();
  session = s;

  session.on('accepted', onAccepted.bind(session));
  session.once('bye', onTerminated.bind(session));
  session.once('failed', onTerminated.bind(session));
  session.once('cancel', onTerminated.bind(session));
}

function onTerminated() {
  session = null;
  attachMediaStream($('#remote-media')[0], null);
}

function onAccepted() {
  attachMediaStream($('#remote-media')[0], this.mediaHandler.getRemoteStreams()[0]);
}

function attachMediaStream(element, stream) {
  if (typeof element.src !== 'undefined') {
    URL.revokeObjectURL(element.src);
    element.src = URL.createObjectURL(stream);
  } else if (typeof element.srcObject !== 'undefined' || typeof element.mozSrcObject !== 'undefined') {
    element.srcObject = element.mozSrcObject = stream;
  } else {
    console.log('Error attaching stream to element.');
    return false;
  }

  ensureMediaPlaying(element);
  return true;
}

function ensureMediaPlaying(mediaElement) {
  var interval = 100;
  mediaElement.ensurePlayingIntervalId = setInterval(function () {
    if (mediaElement.paused) {
      mediaElement.play()
    } else {
      clearInterval(mediaElement.ensurePlayingIntervalId);
    }
  }, interval);
}
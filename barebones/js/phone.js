

// FILL IN THESE VALUES
// for details, see http://sipjs.com/api/0.5.0/ua_configuration_parameters/
var form = $('.signup-body');
var apiNodeBaseUrl = '/api/v2/';
fUsername = form.find('input[name=username]');
fPassword = form.find('input[name=password]');
var formData = {};
var token = null;
var config = {};
form.find('#log_in').click(function (e) {
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
        }).then(getSip, loginFailure);
    }
});
function getSip (data){
  token = data.token;
  $('#formcontainer').hide();
  $.ajax({
      type: "GET",
       headers : {
        'X-Auth-Token' : token
      },
      dataType: 'json',
      cache: false,
      url: "/api/v2/users/sip/",
  }).then(loginSuccess, loginFailure);
}
function loginFailure (data){
  console.log(data);
}
function loginSuccess (data){
  console.log(data);
  $('#stats').html('Login Successful. You are logged in as :' + data.extension);
  config = {
    wsServers :data.websocket_proxy,
    uri : data.public_identity,
    password : data.password,
    authorizationUser : data.extension,
    userAgentString: 'SIP.js/0.5.0-devel BAREBONES DEMO',
    traceSip: true,
  };

  // ensure config values are provided
  var requiredParams = ['wsServers', 'uri', 'authorizationUser', 'password'];
  requiredParams.some(function checkParam (param) {
    if (config[param]) {
      return false;
    }

    alert('config.' + param + ' is not set! Please open phone.js and set each of the following:\n\n\t* config.' + requiredParams.join('\n\t* config.'));
    return true;
  });

  var ua = new SIP.UA(config);

  ua.on('invite', handleInvite);
  ua.on('message', receiveMessage);
}


function handleInvite (s) {
  var text = s.remoteIdentity.uri.toString() + ' is calling you. Accept?';
  var accept = confirm(text);
  if (accept) {
    s.accept(getSessionOptions());
    setupSession(s);
  }
  else {
    s.reject();
  }
}

function receiveMessage (e) {
  var remoteUri = e.remoteIdentity.uri.toString();
  showMessage(remoteUri, e.body);
}

function showMessage (from, body) {
  $('chat-log').textContent += from + ': ' + body + '\n'
  $('log-container').scrollTop = $('log-container').scrollHeight;
}

function sendMessage () {
  var target = $('target').value || (session && session.remoteIdentity.uri.toString());
  if (!target) {
    return;
  }

  var body = $('message').value;
  $('message').value = '';
  ua.message(target, body);
  showMessage(ua.configuration.uri.toString(), body);
}

function sendDtmf (value) {
  if (session && /[1234567890#*]/.test(value)) {
    session.dtmf(value);
  }
}

var session;

function getSessionOptions () {
  return {
    media: {
      audio: true,
      video: false
    }
  };
}

function dial () {
  if (!$('#target')[0].value) {
    return;
  }
  var number = $('#target')[0].value;
  var prospect = {
    sip : number
  };
  var data={
    'prospect':prospect
  }; 

  $.ajax({
      type: "POST",
      headers : {
        'X-Auth-Token' : token
      },
      contentType: "application/json",            
      dataType: 'json',
      cache: false,
      url: apiNodeBaseUrl + 'call/sf-call',
      data: JSON.stringify(data)
  }).then(function(data){
    console.log(data);
  }, loginFailure);
  //setupSession( ua.invite($('target').value, getSessionOptions()) );
}

function endSession () {
  if (session) {
    session.terminate();
  }
}

function setupSession (s) {
  endSession();
  session = s;

  session.on('accepted', onAccepted.bind(session));
  session.once('bye', onTerminated.bind(session));
  session.once('failed', onTerminated.bind(session));
  session.once('cancel', onTerminated.bind(session));
}

function onTerminated () {
  session = null;
  attachMediaStream($('#remote-media')[0], null);
}

function onAccepted () {  
  attachMediaStream($('#remote-media')[0], this.mediaHandler.getRemoteStreams()[0]);   
}

function attachMediaStream (element, stream) {
  if (typeof element.src !== 'undefined') {
    URL.revokeObjectURL(element.src);
    element.src = URL.createObjectURL(stream);
  } else if (typeof element.srcObject !== 'undefined'
       || typeof element.mozSrcObject !== 'undefined') {
    element.srcObject = element.mozSrcObject = stream;
  } else {
    console.log('Error attaching stream to element.');
    return false;
  }

  ensureMediaPlaying(element);
  return true;
}

function ensureMediaPlaying (mediaElement) {
  var interval = 100;
  mediaElement.ensurePlayingIntervalId = setInterval(function () {
    if (mediaElement.paused) {
      mediaElement.play()
    }
    else {
      clearInterval(mediaElement.ensurePlayingIntervalId);
    }
  }, interval);
}

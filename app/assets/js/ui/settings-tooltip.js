/*
    Settings tooltip
*/

'use strict';

// Imports
const ipcRenderer  = nodeRequire('electron').ipcRenderer;
const remote       = nodeRequire('electron').remote;
const keytar       = nodeRequire('keytar');
const globals      = nodeRequire('./assets/js/globals');
const settings     = nodeRequire('./assets/js/settings');
const localization = nodeRequire('./assets/js/localization');

/*
    Event handlers
*/

$(document).ready(function() {
    $('#settings-log-out').click(function() {
        // Don't allow people to spam this
        let now = new Date().getTime();
        if (now - globals.spamTimer < 1000) {
            return;
        } else {
            globals.spamTimer = now;
        }

        // Delete their cached credentials, if any
        let storedUsername = settings.get('username');
        if (typeof storedUsername !== 'undefined') {
            let storedPassword = keytar.getPassword('Racing+', storedUsername);
            if (storedPassword !== null) {
                keytar.deletePassword('Racing+', storedUsername);
            }
            settings.set('username', undefined);
            settings.saveSync();
        }

        // Terminate the WebSocket connection (which will trigger the transition back to the title screen)
        globals.initiatedLogout = true;
        globals.conn.close();
    });

    $('#settings-log-file-location-change').click(function() {
        let titleText = $('#select-your-log-file').html();
        let newLogFilePath = remote.dialog.showOpenDialog({
            title: titleText,
            filters: [
                {
                    'name': 'Text',
                    'extensions': ['txt'],
                }
            ],
            properties: ['openFile'],
        });
        if (newLogFilePath === undefined) {
            return;
        } else {
            let shortenedPath = newLogFilePath[0].substring(0, 24);
            $('#settings-log-file-location').html('<code>' + shortenedPath + '...</code>');
            $('#settings-log-file-location').tooltipster('content', newLogFilePath[0]);
        }
    });

    $('#settings-volume-slider').change(function() {
        $('#settings-volume-slider-value').html($(this).val() + '%');
    });

    $('#settings-volume-test').click(function() {
        // Play the "Go" sound effect
        let audio = new Audio('assets/sounds/go.mp3');
        audio.volume = $('#settings-volume-slider').val() / 100;
        audio.play();
    });

    $('#settings-stream').keyup(function() {
        // If they have specified a Twitch stream:
        // - Reveal the "Enable Twitch chat bot" and uncheck it
        // - Hide the "Delay (in seconds)"
        if ($('#settings-stream').val().includes('twitch.tv/')) {
            $('#settings-enable-twitch-bot-checkbox-container').fadeIn(globals.fadeTime);
            $('#header-settings').tooltipster('reposition'); // Redraw the tooltip
            $('#settings-stream').focus(); // Needed because the redraw causes the input box to lose focus
        } else {
            $('#settings-enable-twitch-bot-checkbox-container').fadeOut(globals.fadeTime);
            $('#settings-twitch-bot-delay-label').fadeOut(globals.fadeTime);
            $('#settings-twitch-bot-delay').fadeOut(globals.fadeTime);
        }

        // They have changed their stream, so disable the Twitch bot
        if ($('#settings-enable-twitch-bot-checkbox').is(':checked')) {
            $('#settings-enable-twitch-bot-checkbox').prop('checked', false); // Uncheck it
            $('#settings-twitch-bot-delay-label').fadeOut(globals.fadeTime);
            $('#settings-twitch-bot-delay').fadeOut(globals.fadeTime);
        }
    });

    $('#settings-enable-twitch-bot-checkbox-container').on('mouseover', function() {
        // Check if the tooltip is open
        if ($('#settings-enable-twitch-bot-checkbox-container').tooltipster('status').open === false &&
            $('#settings-enable-twitch-bot-checkbox').is(':checked') === false) {

            $('#settings-enable-twitch-bot-checkbox-container').tooltipster('open');
        }
    });

    $('#settings-enable-twitch-bot-checkbox').change(function(data) {
        if ($('#settings-enable-twitch-bot-checkbox').prop('checked')) {
            $('#settings-twitch-bot-delay-label').fadeIn(globals.fadeTime);
            $('#settings-twitch-bot-delay').fadeIn(globals.fadeTime);
            $('#header-settings').tooltipster('reposition'); // Redraw the tooltip
        } else {
            $('#settings-twitch-bot-delay-label').fadeOut(globals.fadeTime);
            $('#settings-twitch-bot-delay').fadeOut(globals.fadeTime);
        }
    });

    $('#settings-form').submit(function() {
        // By default, the form will reload the page, so stop this from happening
        event.preventDefault();

        // Don't do anything if we are not on the right screen
        if (globals.currentScreen !== 'lobby') {
            return;
        }

        // Log file location
        let newLogFilePath = $('#settings-log-file-location').tooltipster('content');
        settings.set('logFilePath', newLogFilePath);
        settings.saveSync();

        // Language
        localization.localize($('#settings-language').val());

        // Volume
        settings.set('volume', $('#settings-volume-slider').val() / 100);
        settings.saveSync();

        // Username capitalization
        let newUsername = $('#settings-username-capitalization').val();
        if (newUsername !== globals.myUsername) {
            // We set a new username
            if (newUsername.toLowerCase() !== globals.myUsername.toLowerCase()) {
                // We tried to enter a bogus stylization
                $('#settings-username-capitalization').tooltipster('open');
                return;
            } else {
                $('#settings-username-capitalization').tooltipster('close');
                globals.conn.send('profileSetUsername', {
                    name: newUsername,
                });
            }
        }

        // Stream URL
        let newStream = $('#settings-stream').val();
        if (newStream.startsWith('twitch.tv/')) {
            newStream = 'https://www.' + newStream;
        } else if (newStream.startsWith('www.twitch.tv/')) {
            newStream = 'https://' + newStream;
        } else if (newStream.startsWith('http://')) {
            newStream = newStream.replace('http://', 'https://');
        }
        $('#settings-stream').val(newStream);
        if (newStream !== globals.myStream) {
            // We set a new stream
            if (newStream.startsWith('https://www.twitch.tv/') === false && newStream !== '') {
                // We tried to enter a non-valid stream URL
                $('#settings-stream').tooltipster('open');
                return;
            } else {
                $('#settings-stream').tooltipster('close');
                if (newStream === '') {
                    newStream = '-'; // Streams cannot be blank on the server-side
                }
                globals.conn.send('profileSetStream', {
                    name: newStream,
                });
            }
        }

        // Twitch bot
        // (if we sent a new stream URL above, the Twitch bot was automatically turned off, so just always send the Twitch bot setting for simplicity)
        if ($('#settings-enable-twitch-bot-checkbox').prop('checked')) {
            // Tell the server we want to enable the Twitch bot
            globals.myTwitchBotEnabled = true;
            globals.conn.send('profileSetTwitchBotEnabled', {
                enabled: globals.myTwitchBotEnabled,
            });
        } else {
            // Tell the server we want to disable the Twitch bot
            globals.myTwitchBotEnabled = false;
            globals.conn.send('profileSetTwitchBotEnabled', {
                enabled: globals.myTwitchBotEnabled,
            });
        }

        // Twitch bot delay
        let newDelay = $('#settings-twitch-bot-delay').val();
        if (/^\d+$/.test(newDelay) === false) {
            // We tried to enter a non-number Twitch bot delay
            $('#settings-twitch-bot-delay').tooltipster('open');
            return;
        }
        newDelay = parseInt(newDelay);
        if (newDelay < 0 || newDelay > 60) {
            // We tried to enter a delay out of the valid range
            $('#settings-twitch-bot-delay').tooltipster('open');
            return;
        }
        $('#settings-twitch-bot-delay').tooltipster('close');
        if (newDelay !== globals.myTwitchBotDelay) {
            globals.myTwitchBotDelay = newDelay;
            globals.conn.send('profileSetTwitchBotDelay', {
                value: globals.myTwitchBotDelay,
            });
        }

        // Close the tooltip
        $('#header-settings').tooltipster('close');

        // Restart the program
        //ipcRenderer.send('asynchronous-message', 'restart');
    });
});

/*
    Settings tooltip functions
*/

// The "functionBefore" function for Tooltipster
exports.tooltipFunctionBefore = function() {
    if (globals.currentScreen !== 'lobby') {
        return false;
    }

    $('#gui').fadeTo(globals.fadeTime, 0.1);

    return true;
};

// The "functionReady" function for Tooltipster
exports.tooltipFunctionReady = function() {
    /*
        Fill in all of the settings every time the tooltip is opened
        (this prevents the user having unsaved settings displayed, which is confusing)
    */

    // Username
    $('#settings-username').html(globals.myUsername);

    // Log file location
    let shortenedPath = settings.get('logFilePath').substring(0, 24);
    $('#settings-log-file-location').html('<code>' + shortenedPath + '...</code>');

    // Loanguage
    $('#settings-language').val(settings.get('language'));

    // Volume
    $('#settings-volume-slider').val(settings.get('volume') * 100);
    $('#settings-volume-slider-value').html((settings.get('volume') * 100) + '%');

    // Change username capitalization
    $('#settings-username-capitalization').val(globals.myUsername);

    // Change stream URL
    $('#settings-stream').val(globals.myStream);

    // Hide all of the optional settings by default
    $('#settings-enable-twitch-bot-checkbox-container').fadeOut(0);
    $('#settings-twitch-bot-delay-label').fadeOut(0);
    $('#settings-twitch-bot-delay').fadeOut(0);
    $('#settings-enable-twitch-bot-checkbox').prop('checked', false);

    // Twitch bot delay
    $('#settings-twitch-bot-delay').val(globals.myTwitchBotDelay);

    // Show the checkbox they have a Twitch stream set
    if (globals.myStream.includes('twitch.tv')) {
        $('#settings-enable-twitch-bot-checkbox-container').fadeIn(0);

        // Enable Twitch chat bot
        if (globals.myTwitchBotEnabled) {
            $('#settings-enable-twitch-bot-checkbox').prop('checked', true);
            $('#settings-twitch-bot-delay-label').fadeIn(0);
            $('#settings-twitch-bot-delay').fadeIn(0);
        }
    }

    /*
        Tooltips within tooltips seem to be buggy and can sometimes be uninitialized
        So, check for this every time the tooltip is opened and reinitialize them if necessary
    */

    if ($('#settings-log-file-location').hasClass('tooltipstered') === false) {
        $('#settings-log-file-location').tooltipster({
            theme: 'tooltipster-shadow',
            delay: 0,
            content: settings.get('logFilePath'),
        });
    }

    if ($('#settings-username-capitalizationr').hasClass('tooltipstered') === false) {
        $('#settings-username-capitalization').tooltipster({
            theme: 'tooltipster-shadow',
            delay: 0,
            trigger: 'custom',
        });
    }

    if ($('#settings-stream').hasClass('tooltipstered') === false) {
        $('#settings-stream').tooltipster({
            theme: 'tooltipster-shadow',
            delay: 0,
            trigger: 'custom',
        });
    }

    if ($('#settings-enable-twitch-bot-checkbox-container').hasClass('tooltipstered') === false) {
        $('#settings-enable-twitch-bot-checkbox-container').tooltipster({
            theme: 'tooltipster-shadow',
            delay: 750,
            trigger: 'custom',
            triggerClose: {
                mouseleave: true,
            },
            zIndex: 10000000, /* The default is 9999999, so it just has to be bigger than that so that it appears on top of the settings tooltip */
            interactive: true,
        });
    }

    if ($('#settings-twitch-bot-delay').hasClass('tooltipstered') === false) {
        $('#settings-twitch-bot-delay').tooltipster({
            theme: 'tooltipster-shadow',
            delay: 0,
            trigger: 'custom',
        });
    }

    // Redraw the tooltip
    $('#header-settings').tooltipster('reposition');
};

/*
    Modals
*/

'use strict';

// Imports
const ipcRenderer = nodeRequire('electron').ipcRenderer;
const remote      = nodeRequire('electron').remote;
const shell       = nodeRequire('electron').shell;
const globals     = nodeRequire('./assets/js/globals');
const settings    = nodeRequire('./assets/js/settings');

/*
    Event handlers
*/

$(document).ready(function() {
    /*
        Error modal
    */

    $('#error-modal-button').click(function() {
        if (globals.currentScreen === 'error') {
            ipcRenderer.send('asynchronous-message', 'restart');
        }
    });

    /*
        Warning modal
    */

    $('#warning-modal-button').click(function() {
        // Hide the warning modal
        $('#warning-modal').fadeOut(globals.fadeTime, function() {
            $('#gui').fadeTo(globals.fadeTime, 1);
        });
    });

    /*
        Log file modal
    */

    $('#log-file-link').click(function() {
        let url = 'https://steamcommunity.com/app/250900/discussions/0/613941122558099449/';
        shell.openExternal(url);
    });

    $('#log-file-find').click(function() {
        let titleText = $('#select-your-log-file').html();
        let newLogFilePath = remote.dialog.showOpenDialog({
            title: titleText,
            defaultPath: globals.defaultLogFilePath,
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
        } else if (newLogFilePath[0].match(/[/\\]Binding of Isaac Rebirth[/\\]/)) { // Match a forward or backslash
            // Check to make sure they don't have an Rebirth log.txt selected
            $('#log-file-description-1').fadeOut(globals.fadeTime);
            $('#log-file-description-2').fadeOut(globals.fadeTime, function() {
                $('#log-file-description-1').html('<p lang="en">It appears that you have selected your Rebirth "log.txt" file, which is different than the Afterbirth+ "log.txt" file.</p><p lang="en">Please try again and select your Afterbirth+ log file.</p><br />');
                $('#log-file-description-1').fadeIn(globals.fadeTime);
            });
            return;
        } else if (newLogFilePath[0].match(/[/\\]Binding of Isaac Afterbirth[/\\]/)) {
            // Check to make sure they don't have an Afterbirth log.txt selected
            $('#log-file-description-1').fadeOut(globals.fadeTime);
            $('#log-file-description-2').fadeOut(globals.fadeTime, function() {
                $('#log-file-description-1').html('<p lang="en">It appears that you have selected your Afterbirth "log.txt" file, which is different than the Afterbirth+ "log.txt" file.</p><p lang="en">Please try again and select your Afterbirth+ log file.</p><br />');
                $('#log-file-description-1').fadeIn(globals.fadeTime);
            });
            return;
        }

        settings.set('logFilePath', newLogFilePath[0]);
        settings.saveSync();

        $('#log-file-description-1').fadeOut(globals.fadeTime);
        $('#log-file-description-2').fadeOut(globals.fadeTime, function() {
            $('#log-file-description-3').fadeIn(globals.fadeTime);
        });
        $('#log-file-find').fadeOut(globals.fadeTime, function() {
            $('#log-file-exit').fadeIn(globals.fadeTime);
        });
    });

    $('#log-file-exit').click(function() {
        if (globals.currentScreen === 'error') {
            ipcRenderer.send('asynchronous-message', 'restart');
        }
    });
});

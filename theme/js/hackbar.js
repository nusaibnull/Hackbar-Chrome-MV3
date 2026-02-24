chrome.devtools.panels.create(
    "HackBar",
    "/icons/icon.png", 
    "/theme/hackbar-panel.html",
    function(panel) {
        console.log("HackBar UI Loaded!");
    }
);
'use strict';

let referer;
let user_agent;
let cookie;
let method;
let postDataCurrent = [];

function setCurrentPostData(e) {
    if (e.method === "POST" && e.requestBody && e.requestBody.formData) {
        let rawData = e.requestBody.formData;
        var post_data_array = [];
        for (let key in rawData) {
            if (rawData.hasOwnProperty(key)) {
                var item = key + "=" + rawData[key];
                post_data_array.push(item);
            }
        }
        chrome.tabs.query({currentWindow: true, active: true}, function (tabArray) {
            if (tabArray.length > 0) {
                const currentTabId = tabArray[0].id;
                postDataCurrent.push({'tabId': currentTabId, 'data': post_data_array.join("&")});
            }
        });
    }
}

function getCurrentPostData(currentTabId) {
    for (let i = 0; i < postDataCurrent.length; i++) {
        if (postDataCurrent[i].tabId === currentTabId) {
            return postDataCurrent[i].data;
        }
    }
    return null;
}

// Update headers (Referer, User-Agent, Cookie) for Manifest V3
function updateHeaders(tabId, referer, user_agent, cookie) {
    let rules = [];
    let ruleId = 1;
    
    if (referer) {
        rules.push({
            id: ruleId++,
            priority: 1,
            action: { type: "modifyHeaders", requestHeaders: [{ header: "Referer", operation: "set", value: referer }] },
            condition: { tabIds: [tabId], resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"] }
        });
    }
    if (user_agent) {
        rules.push({
            id: ruleId++,
            priority: 1,
            action: { type: "modifyHeaders", requestHeaders: [{ header: "User-Agent", operation: "set", value: user_agent }] },
            condition: { tabIds: [tabId], resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"] }
        });
    }
    if (cookie) {
        rules.push({
            id: ruleId++,
            priority: 1,
            action: { type: "modifyHeaders", requestHeaders: [{ header: "Cookie", operation: "set", value: cookie }] },
            condition: { tabIds: [tabId], resourceTypes: ["main_frame", "sub_frame", "xmlhttprequest"] }
        });
    }

    // Remove old rules and add new rules
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [1, 2, 3], 
        addRules: rules
    });
}

function handleMessage(request, sender, sendResponse) {
    // Receive message from the extension panel
    if (sender.url && !sender.url.includes("theme/hackbar")) {
        // return; 
    }
    
    const tabId = request.tabId;
    const action = request.action;
    
    switch (action) {
        case 'send_requests':
            const Data = request.data;
            const url = Data.url;
            method = Data.method;
            referer = Data.referer;
            user_agent = Data.user_agent;
            cookie = Data.cookie;
            
            // Call header update for MV3
            updateHeaders(tabId, referer, user_agent, cookie);

            if (method === 'GET') {
                chrome.tabs.update(tabId, {url: url});
            } else {
                const post_data = JSON.stringify(Data.post_data);
                
                // Use chrome.scripting.executeScript for Manifest V3
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: (pData, pUrl) => {
                        window.post_data = decodeURIComponent(pData);
                        window.url = decodeURIComponent(pUrl);
                    },
                    args: [encodeURIComponent(post_data), encodeURIComponent(url)]
                }, () => {
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['theme/js/post_form.js']
                    });
                });
            }
            sendResponse({status: true});
            break;
            
        case 'load_url':
            chrome.tabs.get(tabId, function (tab) {
                const data = getCurrentPostData(tabId);
                sendResponse({url: tab.url, data: data});
            });
            break;
    }
    return true; 
}

chrome.webRequest.onBeforeRequest.addListener(
    setCurrentPostData,
    {urls: ["<all_urls>"]},
    ["requestBody"]
);

chrome.runtime.onMessage.addListener(handleMessage);
# TheMonkeyWindowProject
Grease/Tamper-Monkey user script who is the base to creates simple windows in page area. 

To use required TemperMonkey or GreaseMonkey extension available for many top browsers. If You have these extension, to install these script [click here](https://github.com/sharkson-mgn/TheMonkeyWindowProject/raw/main/tmwp.user.js).

That is framework who allows to create windows.

How it use?

When You have created own user script, follow the script:
```// ==UserScript==
  EXAMPLE OF SCRIPT, BEHIND IS NEEDED ATTRIBUTES!
// @run-at       document-end or document-body recommended
// @grant        unsafeWindow
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // need access to unsafeWindow
    if (typeof unsafeWindow == 'undefined') {
        unsafeWindow = (function() {
            var el = document.createElement('p');
            el.setAttribute('onclick', 'return window;');
            return el.onclick();
        }());
    }

    if (typeof unsafeWindow._tmwp == 'undefined') {
        console.log('_twmp is UNDEFINED! To run this user script external script needed!');
        console.log('USERSCRIPT WINDOW HERE');
        return;
    }
    
    //rest of code
    const myWindow = new unsafeWindow._tmwp({
      resizable: true, //allow to resizable
      draggable: true, //allow to draggable
      rememberPos: true, //remember pos, draggable needed
      rememberSize: true, //remember size, resizable needed
      closable: true, //allow to close created window, then add "x" icon
      centered: true, //created window is centered in website area
      title: 'example of my own title',  //using front framework you can insert <component /> here
      content: 'example of my own content' //like title
    });
    
    //to styling window You can use GM_addStyle:
    GM_addStyle(`
      .${myWindow.getWindowClass()} {
        background-color: red;
      }
    `);
    
 })();
 ```
 
Additional, You can use any framework like Vue:
```
app.mount('#${myWindow.getWindowId()});
```

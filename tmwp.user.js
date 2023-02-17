// ==UserScript==
// @name         TheMonkeyWindowProject
// @namespace    http://sharkson.eu/
// @supportURL   https://github.com/sharkson-mgn/TheMonkeyWindowProject
// @downloadURL  https://github.com/sharkson-mgn/TheMonkeyWindowProject/raw/main/tmwp.user.js
// @updateURL    https://github.com/sharkson-mgn/TheMonkeyWindowProject/raw/main/tmwp.user.js
// @version      0.2.2
// @description  [TMWP]
// @author       sharkson-mgn
// @match        http*://*/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @run-at       document-start
// @grant        unsafeWindow
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @require      https://code.jquery.com/jquery-3.6.1.min.js#sha256=o88AwQnZB+VDvE9tvIXrMQaPlFFSUTR+nldQm1LuPXQ=
// @require      https://code.jquery.com/ui/1.13.2/jquery-ui.min.js
// @resource     jQueryUiCSS https://code.jquery.com/ui/1.13.2/themes/black-tie/jquery-ui.css
// ==/UserScript==

(function() {
    'use strict';

    if (typeof unsafeWindow == 'undefined') {
        const unsafeWindow = (function() {
            const el = document.createElement('p');
            el.setAttribute('onclick', 'return window;');
            return el.onclick();
        }());
    }

    //var _msStyle = ``;

    const wm = function(options = {}) {

        this.tmwpid = '_twmp';

        const storage = {
            get: function(key)
            {
                let val = localStorage.getItem(key);
                if (val)
                    if (/^[\],:{}\s]*$/.test(val.replace(/\\["\\\/bfnrtu]/g, '@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').replace(/(?:^|:|,)(?:\s*\[)+/g, '')))
                        val = JSON.parse(val);

                return val;
            },
            set: (key,val) => localStorage.setItem(key, JSON.stringify(val)),

            rem: (key) => localStorage.removeItem(key)
        }

        const that = this;

        this.randStr = (len = 8) => Array.from(Array(len)).map(() => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');

        this.getId = function() { return this.param.globId; };
        this.getWindowId = function() { return `${this.tmwpid}_${this.param.globId}_wrapper`; };
        this.getHeaderId = function() { return `${this.tmwpid}_${this.param.globId}_header`; };
        this.getWindowClass = function() { return `_tmwpGlobalClass_`; };
        this.getTitleId = function() { return `${this.tmwpid}_${this.param.globId}_title`; };
        this.getContentId = function() { return `${this.tmwpid}_${this.param.globId}_content`; };
        this.getIconsId = function() { return `${this.tmwpid}_${this.param.globId}_icons`; };

        this.getWindowIcon = function() {
            return this.param.majorTitle.replace(/[a-z]/g, '');
        };

        this.checkY = (int) =>  (int || int === 0) ? Math.min($(window).innerHeight() - $( `#${this.getWindowId()}` ).outerHeight(),Math.max( 0, int )) : int;
        this.checkX = (int) => (int || int === 0) ? Math.min($(window).innerWidth() - $( `#${this.getWindowId()}` ).outerWidth(),Math.max( 0, int )) : int;

        this.close = function(callback = null) {
            if ($(`#${this.getIconsId()} .wmClose`)) {
                if (typeof callback == 'function') {
                    this.call(this,callback);
                }
                $(`#${this.getIconsId()} .wmClose`).click();
            }
        }

        this.updatePos = function() {
            if (this.param.rememberPos) {
                $( `#${this.getWindowId()}` ).css({
                    top: that.checkY(that.fromPercentWindow(that.storage.posTop,'height')),
                    left: that.checkX(that.fromPercentWindow(that.storage.posLeft))
                });
            }

            if (this.param.rememberSize) {
                $( `#${this.getWindowId()}` ).css({
                    width: that.storage.sizeWidth,
                    height: that.storage.sizeHeight
                });
            }

            if ((this.storage.isMinimized ^ $( `#${this.getWindowId()}` ).hasClass('wmMinimized'))) {
                $( `#${this.getWindowId()} .wmWindowIcon` ).click();
            }
        };

        this.addIcon = function(html) {
            $(`#${this.getIconsId()}`).prepend(html);
        };

        this.fromPercentWindow = function(percent,dim = 'width') {
            return (window['inner' + dim.charAt(0).toUpperCase() + dim.slice(1)] * percent) / 100;
        }
        this.toPercentWindow = function(percent,dim = 'width') {
            return (percent * 100) / window['inner' + dim.charAt(0).toUpperCase() + dim.slice(1)];
        }

        this.param = {
            majorTitle: null,
            title: 'example title',
            content: 'example content',
            draggable: false,
            resizable: false,
            closable: false,
            rememberPos: false,
            rememberSize: false,
            centered: false,
            clickOutside: false,
            id: this.randStr(),
            globId: !unsafeWindow.document.querySelector('.wmWrapperWindow') ? 'mainWindow' : this.randStr(),
            ...options
        };

        if (this.param.globId === '_RANDOM_') {
            this.param.globId = this.randStr();
        }

        if (document.querySelector('#' + this.getWindowId())) {
            return false;
        }

        this.storage = new Proxy(
            {},
            {
                get: function(obj, name) {
                    return storage.get(that.param.globId + '_' + name);
                },
                set: function(obj, name, value) {
                    /*console.log('write request to ' + name + ' property with ' + value + ' value');*/

                    storage.set(that.param.globId + '_' + name,value);
                    return true;
                },
            }
        );

        if (this.param.clickOutside) {
            document.addEventListener('click', function somefunction (event) {
                console.log(that.getWindowId());
                const box = document.getElementById(that.getWindowId());

                if (box && !box.contains(event.target)) {
                    //box.style.display = 'none';
                    //box.remove();
                }
            });

        }

        if (!!this.param.majorTitle) {
            this.param.title = this.param.majorTitle + ' ' + this.param.title;
        }

        $('body').append(`
            <div id="${this.getWindowId()}" class="${this.getWindowClass()}${this.storage.isMinimized ? ' wmMinimized' : ''} wmWrapperWindow" data-windowName="${this.param.globId}" data-windowId="${this.param.id}">
                <div id="${this.getHeaderId()}" class="wmHeader">
                    ${(!!this.param.majorTitle) ? `<div class="wmWindowIcon">${this.getWindowIcon()}</div>` : `` }
                    <div id="${this.getTitleId()}" class="wmTitle">
                        ${this.param.title}
                    </div>
                    <div id="${this.getIconsId()}" class="wmIcons"></div>
                </div>
                <div id="${this.getContentId()}" class="wmContent">
                    ${this.param.content}
                </div>
            </div>
        `);

        if (!!this.param.majorTitle) {
            $(`.wmWindowIcon`).click(function() {
                console.log('dezdowe');
            });
        }

        if ($(`.${this.getWindowClass()}`).length == 1) {
            const jQueryUiCSS = GM_getResourceText("jQueryUiCSS");
            GM_addStyle(jQueryUiCSS);

            GM_addStyle(`
                .${this.getWindowClass()} {
                    font-family: Arial, Helvetica, sans-serif;
                    color: black;
                    position: fixed;
                    top: 1em;
                    left: 1em;
                    display: flex;
                    flex-direction: column;
                    background-color: silver;
                    border: 1px grey solid;
                    font-size: 12px;
                    padding: 0.2em;
                    min-width: 150px;
                    min-height: 100px;
                    overflow: hidden;
                    z-index: 999999;
                    line-height: 1.5em;
                }

                .${this.getWindowClass()} .wmHeader {
                    border-bottom: 1px grey solid;
                    display: flex;
                    align-items: center;
                }

                .${this.getWindowClass()} .wmWindowIcon {
                    display: flex;
                    border: 1px grey solid;
                    aspect-ratio: 1/1;
                    max-height: 1.8em;
                    border-radius: 50%;
                    font-size: 0.8em;
                    font-weight: bold;
                    align-items: center;
                    padding: 1em;
                    justify-content: center;
                    cursor: pointer;
                    background-color: white;
                    transition: 0.5s;
                }
                .${this.getWindowClass()} .wmWindowIcon:hover {
                    border: 1px black solid;
                }

                .${this.getWindowClass()} .wmIcons {
                    line-height: 1em;
                    font-size: 1.2em;
                    display: flex;
                }

                .${this.getWindowClass()} .wmIcons span {
                    cursor: pointer;
                    padding: 2px;
                    border: 1px transparent solid;
                    line-height: initial;
                }
                .${this.getWindowClass()} .wmIcons span:hover {
                    border: 1px grey solid;
                }

                .${this.getWindowClass()} .wmTitle {
                    padding: 0.2em;
                    display: flex;
                    align-items: baseline;
                    width: 100%;
                    gap: 0.5em;
                    white-space: nowrap;
                    overflow: hidden;
                }

                .${this.getWindowClass()} .wmTitle.dragged {
                    background-color: #fff6;
                }

                .${this.getWindowClass()} .wmContent {
                    overflow: hidden auto;
                    display: flex-item;
                    width: 100%;
                    scrollbar-width: thin;
                    height: 100%;
                    padding: 0.2em;
                }

                .${this.getWindowClass()}.wmMinimized {
                    font-size: 1.5em;
                    min-width: unset;
                    min-height: unset;
                    width: auto !important;
                    height: auto !important;
                    border-color: transparent !important;
                    background-color: transparent !important;
                    box-shadow: none !important;
                    overflow: visible !important;
                }

                .${this.getWindowClass()}.wmMinimized .wmHeader *,
                .${this.getWindowClass()}.wmMinimized .wmContent {
                    display: none !important;
                }

                .${this.getWindowClass()}.wmMinimized .wmHeader {
                    border-width: 0;
                }

                .${this.getWindowClass()}.wmMinimized .wmHeader .wmWindowIcon {
                    display: flex !important;
                    border-color: red;
                }

                .ui-icon-gripsmall-diagonal-se {
                    background-image: url("https://code.jquery.com/ui/1.11.4/themes/ui-lightness/images/ui-icons_222222_256x240.png");
                }
            `);

            if (typeof _wmStyle !== 'undefined') {
                GM_addStyle(_wmStyle);
            }
        }

        GM_addStyle(`
            .${this.getWindowClass()} {
                width: ${this.param.width || '150px'};
                height: ${this.param.height || '100px'};
            }
       `);

        if (this.param.draggable) {
            GM_addStyle(`
                #${this.getTitleId()} {
                    cursor: move;
                }
            `);
            $( `#${this.getWindowId()}` ).draggable({
                containment: "document",
                handle: `#${that.getHeaderId()}`,
                scroll: false,
                start: function(event,ui) {
                    event.target.querySelector('#'+that.getHeaderId()).classList.add('dragged');
                    $( `#${that.getWindowId()}` ).addClass('wmDragging');
                },
                drag: function(event,ui) {
                    ui.position.top = that.checkY(ui.position.top);
                    ui.position.left = that.checkX(ui.position.left);
                    if (that.param.rememberPos) {
                        that.storage.posTop = that.toPercentWindow(ui.position.top,'height');
                        that.storage.posLeft = that.toPercentWindow(ui.position.left);
                    }
                },
                stop: function(event,ui) {
                    event.target.querySelector('#'+that.getHeaderId()).classList.remove('dragged');
                }
            });
        }

        this.makeResizable = function() {
            this.param.resizable = true;
            $( `#${this.getWindowId()}` ).resizable({
                contaiment: `#${this.getWindowId()}`,
                //autoHide: true,
                handles: "n, e, s, w, se, sw",
                resize: function(event,ui) {
                    //if (that.param.rememberSize && !document.querySelector('#'+that.getWindowId()).classList.contains('wmMinimized')) {
                    if (that.param.rememberSize) {
                        that.storage.sizeWidth = ui.size.width;
                        that.storage.sizeHeight = ui.size.height;
                    }
                }
            });
        }

        /*if (this.param.resizable) {
            this.makeResizable();
        }*/

        this.updatePos();

        this.makeSyncable = function() {
            setInterval(() => this.updatePos(),500);
        };

        if (this.param.centered) {
            $(`#${this.getWindowId()}`).css({
                top: $(window).innerHeight() / 2 - $(`#${this.getWindowId()}`).outerHeight() / 2,
                left: $(window).innerWidth() / 2 - $(`#${this.getWindowId()}`).outerWidth() / 2
            });
        }

        window.addEventListener('focus',() => { that.updatePos() });
        window.addEventListener('resize',() => { that.updatePos() });

        setTimeout(() => {
            if (this.param.closable) {
                $(`#${this.getIconsId()}`).append(`
                <span class="wmClose">&#x2715</span>
            `);
                $(`#${this.getIconsId()}.wmIcons .wmClose`).click(function() {
                    $(`#${that.getWindowId()}`).remove();
                });
            }
            if (this.param.resizable && !this.storage.isMinimized) {
                this.makeResizable();
            }
            $(`#${this.getWindowId()} .wmWindowIcon`).click(() => {
                if ( $(`#${this.getWindowId()}`).hasClass('wmDragging') ) {
                    $(`#${this.getWindowId()}`).removeClass('wmDragging')
                    return;
                }
                $(`#${this.getWindowId()}`).toggleClass('wmMinimized');

                if ( $(`#${this.getWindowId()}`).hasClass('wmMinimized') ) {
                    $(`#${this.getWindowId()}`).resizable('destroy');
                    this.param.resizable = false;
                } else {
                    this.makeResizable();
                }

                this.storage.isMinimized = $(`#${this.getWindowId()}`).hasClass('wmMinimized');
            });
        });

        return new function() {
            this.getId = () => that.getId();
            this.getWindowId = () => that.getWindowId();
            this.getHeaderId = () => that.getHeaderId();
            this.getTitleId = () =>  that.getTitleId();
            this.getContentId = () =>  that.getContentId();
            this.randStr = () => that.randStr();
            this.makeResizable = () => that.makeResizable();
            this.addIcon = (html) => that.addIcon(html);
            this.getWindowClass = () => that.getWindowClass();
            this.makeSyncable = () => that.makeSyncable();
        };

    };

    unsafeWindow._tmwp = wm;

})();

// ==UserScript==
// @name         TheMonkeyWindowProject
// @namespace    http://sharkson.eu/
// @supportURL   https://github.com/sharkson-mgn/TheMonkeyWindowProject
// @version      0.1
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
// @require      https://unpkg.com/vue@3/dist/vue.global.js
// @require      https://unpkg.com/vuex@4.0.0/dist/vuex.global.js
// @resource     jQueryUiCSS https://code.jquery.com/ui/1.13.2/themes/black-tie/jquery-ui.css
// ==/UserScript==

(function() {
    'use strict';

    if (typeof unsafeWindow == 'undefined') {
        unsafeWindow = (function() {
            var el = document.createElement('p');
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

        this.getId = function() { return this.param.id; };
        this.getWindowId = function() { return `${this.tmwpid}_${this.param.id}_wrapper`; };
        this.getWindowClass = function() { return `_tmwpGlobalClass_`; };
        this.getTitleId = function() { return `${this.tmwpid}_${this.param.id}_title`; };
        this.getContentId = function() { return `${this.tmwpid}_${this.param.id}_content`; };
        this.getIconsId = function() { return `${this.tmwpid}_${this.param.id}_icons`; };

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
                    top: that.checkY(that.storage.posTop),
                    left: that.checkX(that.storage.posLeft)
                });
            }

            if (this.param.rememberSize) {
                $( `#${this.getWindowId()}` ).css({
                    width: that.storage.sizeWidth,
                    height: that.storage.sizeHeight
                });
            }
        };

        this.addIcon = function(html) {
            $(`#${this.getIconsId()}`).prepend(html);
        };

        this.param = {
            title: 'example title',
            content: 'example content',
            draggable: false,
            resizable: false,
            closable: false,
            rememberPos: false,
            rememberSize: false,
            centered: false,
            id: this.randStr(),
            globId: !unsafeWindow.document.querySelector('.wmWrapperWindow') ? 'mainWindow' : this.randStr(),
            ...options
        };

        if (this.param.globId === '_RANDOM_') {
            this.param.globId = this.randStr();
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

        $('body').append(`
            <div id="${this.getWindowId()}" class="${this.getWindowClass()} wmWrapperWindow" data-windowName="${this.param.globId}" data-windowId="${this.param.id}">
                <div id="${this.getIconsId()}" class="wmIcons"></div>
                <div id="${this.getTitleId()}" class="wmTitle">
                    ${this.param.title}
                </div>
                <div id="${this.getContentId()}" class="wmContent">
                    ${this.param.content}
                </div>
            </div>
        `);

        if (this.param.closable) {
            $(`#${this.getIconsId()}`).append(`
                <span class="wmClose">&#x2715</span>
            `);
            $(`#${this.getIconsId()} .wmClose`).click(function() {
                $(`#${that.getWindowId()}`).remove();
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

                .${this.getWindowClass()} .wmIcons {
                    position: absolute;
                    top: 0.2em;
                    right: 0.2em;
                    padding-right: 0.2em;
                    padding-top: 0.2em;
                    line-height: 1em;
                    font-size: 1.2em;
                }

                .${this.getWindowClass()} .wmIcons span {
                    cursor: pointer;
                    padding: 2px;
                    border: 1px transparent solid;
                }
                .${this.getWindowClass()} .wmIcons span:hover {
                    border: 1px grey solid;
                }

                .${this.getWindowClass()} .wmTitle {
                    border-bottom: 1px grey solid;
                    padding: 0.2em;
                }

                .${this.getWindowClass()} .wmTitle.dragged {
                    background-color: #fff6;
                }

                .${this.getWindowClass()} .wmContent {
                    overflow: auto;
                    display: flex-item;
                    width: 100%;
                    scrollbar-width: thin;
                    height: 100%;
                    padding: 0.2em;
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
       `)

        if (this.param.draggable) {
            GM_addStyle(`
                #${this.getTitleId()} {
                    cursor: move;
                }
            `);
            $( `#${this.getWindowId()}` ).draggable({
                handle: `#${that.getTitleId()}`,
                scroll: false,
                start: function(event,ui) {
                    event.target.querySelector('.wmTitle').classList.add('dragged');
                },
                drag: function(event,ui) {
                    ui.position.top = that.checkY(ui.position.top);
                    ui.position.left = that.checkX(ui.position.left);
                    if (that.param.rememberPos) {
                        that.storage.posTop = ui.position.top;
                        that.storage.posLeft = ui.position.left;
                    }
                },
                stop: function(event,ui) {
                    event.target.querySelector('.wmTitle').classList.remove('dragged');
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
                    if (that.param.rememberSize) {
                        that.storage.sizeWidth = ui.size.width;
                        that.storage.sizeHeight = ui.size.height;
                    }
                }
            });
        }

        if (this.param.resizable) {
            this.makeResizable();
        }

        this.updatePos();

        if (this.param.centered) {
            $(`#${this.getWindowId()}`).css({
                top: $(window).innerHeight() / 2 - $(`#${this.getWindowId()}`).outerHeight() / 2,
                left: $(window).innerWidth() / 2 - $(`#${this.getWindowId()}`).outerWidth() / 2
            });
        }

        window.onfocus = function() {
            that.updatePos();
        };

        return new function() {
            this.getId = () => that.getId();
            this.getWindowId = () => that.getWindowId();
            this.getTitleId = () =>  that.getTitleId();
            this.getContentId = () =>  that.getContentId();
            this.randStr = () => that.randStr();
            this.makeResizable = () => that.makeResizable();
            this.addIcon = (html) => that.addIcon(html);
            this.getWindowClass = () => that.getWindowClass();
        };

    };

    unsafeWindow._tmwp = wm;

})();

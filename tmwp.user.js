// ==UserScript==
// @name         The Monkey Window Project 2
// @namespace    rluczak.dev
// @supportURL   https://github.com/sharkson-mgn/TheMonkeyWindowProject
// @downloadURL  https://github.com/sharkson-mgn/TheMonkeyWindowProject/raw/main/tmwp.user.js
// @updateURL    https://github.com/sharkson-mgn/TheMonkeyWindowProject/raw/main/tmwp.user.js
// @version      1.0.0
// @description  [TMWP] Alpine.js based window manager for userscripts
// @author       sharkson-mgn
// @match        *://*/*
// @require      https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/cdn.min.js
// @require      https://code.jquery.com/jquery-3.5.1.min.js
// @require      https://code.jquery.com/ui/1.12.1/jquery-ui.min.js
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @noframes
// @run-at       document-body
// ==/UserScript==

(function () {
    'use strict';

    const getUnsafeWindow = () => {
        if (typeof unsafeWindow !== 'undefined') {
            return unsafeWindow;
        }

        try {
            const el = document.createElement('div');
            el.setAttribute('onclick', 'return window;');
            return el.onclick();
        } catch (e) {
            return window;
        }
    };

    const targetWindow = getUnsafeWindow();

    targetWindow.Alpine = Alpine;

    /* targetWindow.deferLoadingAlpine = (callback) => {
        callback();
    }; */

    // Utility - GM_addStyle wrapper
    const _gm_addStyle = (function () {
        if (typeof GM_addStyle != 'undefined') {
            return GM_addStyle;
        }
        return function (css) {
            const style = document.createElement('style');
            style.appendChild(document.createTextNode(css));
            document.head.appendChild(style);
        };
    })();

    // TMWP2 Core - Alpine.js based Window Manager
    const TMWP2 = function () {
        const that = this;

        this.initialized = false;
        this.container = null;

        // Inicjalizacja TMWP2
        this.init = function (config = {}) {
            if (this.initialized) {
                console.warn('[TMWP2] Already initialized');
                return this.getAPI();
            }

            // Czekaj na Alpine.js
            if (typeof Alpine === 'undefined') {
                console.error('[TMWP2] Alpine.js not loaded');
                return null;
            }

            // Rejestruj Alpine store
            Alpine.store('tmwp', {
                windows: [],
                contextMenu: null,
                hidden: GM_getValue('tmwp2_hidden', false),

                // Ukryj/pokaż cały interfejs
                toggleHidden() {
                    this.hidden = !this.hidden;
                    GM_setValue('tmwp2_hidden', this.hidden);
                },

                // Dodaj okno
                addWindow(windowConfig) {
                    const id = windowConfig.id || 'window_' + Date.now();
                    const existingIndex = this.windows.findIndex(w => w.id === id);

                    // Załaduj zapisaną pozycję z localStorage PRZED walidacją
                    if (typeof localStorage !== 'undefined') {
                        const savedPos = localStorage.getItem('tmwp2_window_' + id + '_position');
                        if (savedPos) {
                            try {
                                const pos = JSON.parse(savedPos);
                                if (windowConfig.x === null || windowConfig.x === undefined) {
                                    windowConfig.x = pos.left; // localStorage używa 'left', nie 'x'
                                    windowConfig.y = pos.top;  // localStorage używa 'top', nie 'y'
                                    windowConfig.centered = false; // Nie centruj jeśli mamy zapisaną pozycję
                                }
                            } catch (e) { }
                        }

                        const savedSize = localStorage.getItem('tmwp2_window_' + id + '_size');
                        if (savedSize) {
                            try {
                                const size = JSON.parse(savedSize);
                                if (!windowConfig.width || !windowConfig.height) {
                                    windowConfig.width = size.width;
                                    windowConfig.height = size.height;
                                }
                            } catch (e) { }
                        }
                    }

                    // Waliduj i popraw pozycję oraz rozmiar
                    const validated = this.validateWindowBounds(windowConfig);

                    if (existingIndex !== -1) {
                        // Aktualizuj istniejące okno
                        this.windows[existingIndex] = { ...this.windows[existingIndex], ...validated, id };
                    } else {
                        // Sprawdź czy okno ma zapisany stan zminimalizowania
                        const savedState = localStorage.getItem(`tmwp2_window_${id}_minimized`);
                        const isMinimized = savedState === 'true';

                        // Dodaj nowe okno
                        this.windows.push({
                            id,
                            title: validated.title || 'Window',
                            content: validated.content || '',
                            width: validated.width || '400px',
                            height: validated.height || '300px',
                            x: validated.x || null,
                            y: validated.y || null,
                            centered: validated.centered !== false,
                            closable: validated.closable !== false,
                            draggable: validated.draggable !== false,
                            resizable: validated.resizable || false,
                            minimized: isMinimized,
                            component: validated.component || null
                        });
                    }
                },

                // Waliduj pozycję i rozmiar okna
                validateWindowBounds(config) {
                    const viewport = {
                        width: window.innerWidth,
                        height: window.innerHeight
                    };

                    // Parsuj rozmiary (usuwając 'px' jeśli jest)
                    let width = parseInt(String(config.width).replace('px', '')) || 400;
                    let height = parseInt(String(config.height).replace('px', '')) || 300;
                    let x = config.x !== null && config.x !== undefined ? parseInt(String(config.x).replace('px', '')) : null;
                    let y = config.y !== null && config.y !== undefined ? parseInt(String(config.y).replace('px', '')) : null;

                    // Sprawdź minimalny rozmiar (nie może być zerowy)
                    if (width <= 0) width = 400;
                    if (height <= 0) height = 300;

                    // Sprawdź czy okno nie jest za duże dla viewport
                    if (width > viewport.width - 20) width = viewport.width - 20;
                    if (height > viewport.height - 20) height = viewport.height - 20;

                    // Jeśli pozycja jest ustawiona, sprawdź czy okno jest w widoku
                    if (x !== null && y !== null) {
                        // Sprawdź lewą krawędź
                        if (x < 0) x = 10;
                        // Sprawdź górną krawędź
                        if (y < 0) y = 10;
                        // Sprawdź prawą krawędź
                        if (x + width > viewport.width) x = viewport.width - width - 10;
                        // Sprawdź dolną krawędź
                        if (y + height > viewport.height) y = viewport.height - height - 10;

                        // Jeśli nadal nie mieści się, wyśrodkuj
                        if (x < 0 || y < 0) {
                            x = null;
                            y = null;
                        }
                    }

                    return {
                        ...config,
                        width: width + 'px',
                        height: height + 'px',
                        x,
                        y,
                        centered: (x === null || y === null) ? true : config.centered
                    };
                },

                // Usuń okno
                removeWindow(id) {
                    this.windows = this.windows.filter(w => w.id !== id);
                },

                // Pokaż menu kontekstowe
                showMenu(items, x, y) {
                    this.contextMenu = { items, x, y };
                },

                // Ukryj menu kontekstowe
                hideMenu() {
                    this.contextMenu = null;
                }
            });

            // Rejestruj komponenty Alpine PRZED dodaniem HTML
            this.registerComponents(config.components || {});

            // Utwórz container
            const containerId = config.containerId || 'tmwp2-app-container';
            let container = document.getElementById(containerId);

            if (!container) {
                container = document.createElement('div');
                container.id = containerId;
                container.setAttribute('x-data', '{}');
                document.body.appendChild(container);
            }

            this.container = container;

            // Dodaj template
            container.innerHTML = `
                <!-- Window Manager -->
                <div x-show="!$store.tmwp.hidden">
                    <!-- Windows -->
                    <template x-for="win in $store.tmwp.windows" :key="win.id">
                        <div 
                            :id="'tmwp2-window-' + win.id"
                            class="tmwp2-window"
                            :style="windowStyle(win)"
                            x-data="tmwp2Window(win)"
                            :class="{ 'tmwp2-minimized': localStorage.getItem('tmwp2_window_' + win.id + '_minimized') === 'true' }"
                        >
                            <!-- Header -->
                            <div class="tmwp2-header" :id="'tmwp2-header-' + win.id" style="display: flex; align-items: center;">
                                <div style="flex: 1;" x-html="win.title"></div>
                                <button 
                                    x-show="win.closable"
                                    @click.stop="$store.tmwp.removeWindow(win.id)"
                                    class="tmwp2-close-btn"
                                    style="background: none; border: none; color: #333; cursor: pointer; font-size: 16px; padding: 0 5px;"
                                >×</button>
                            </div>
                            
                            <!-- Content -->
                            <div class="tmwp2-content" x-html="win.content"></div>
                        </div>
                    </template>

                    <!-- Context Menu -->
                    <div 
                        x-show="$store.tmwp.contextMenu"
                        class="tmwp2-context-menu"
                        :style="menuStyle()"
                        @click.away="$store.tmwp.hideMenu()"
                        x-data="tmwp2ContextMenu()"
                    >
                        <template x-for="(item, index) in items" :key="index">
                            <div>
                                <!-- Separator -->
                                <div x-show="item.separator" class="tmwp2-menu-separator"></div>
                                
                                <!-- Menu Item -->
                                <div 
                                    x-show="!item.separator"
                                    class="tmwp2-menu-item"
                                    :class="{ 'tmwp2-menu-item-disabled': item.disabled }"
                                    @click="handleMenuClick(item)"
                                    @mouseenter="activeSubmenu = item.submenu ? index : null;"
                                >
                                    <span class="tmwp2-menu-icon" x-text="item.icon || ''"></span>
                                    <span class="tmwp2-menu-label" x-text="item.label"></span>
                                    <span x-show="item.submenu" class="tmwp2-menu-arrow">▶</span>
                                    
                                    <!-- Submenu -->
                                    <div 
                                        x-show="activeSubmenu === index && item.submenu"
                                        class="tmwp2-menu-submenu"
                                        @click.stop
                                        x-init="$watch('activeSubmenu', value => { if(value === index && item.submenu) { $nextTick(() => checkSubmenuPosition($el)) } })"
                                    >
                                        <template x-for="(subitem, subindex) in item.submenu" :key="subindex">
                                            <div>
                                                <div x-show="subitem.separator" class="tmwp2-menu-separator"></div>
                                                <div 
                                                    x-show="!subitem.separator"
                                                    class="tmwp2-menu-item"
                                                    :class="{ 'tmwp2-menu-item-disabled': subitem.disabled }"
                                                    @click="handleMenuClick(subitem)"
                                                >
                                                    <span class="tmwp2-menu-icon" x-text="subitem.icon || ''"></span>
                                                    <span class="tmwp2-menu-label" x-text="subitem.label"></span>
                                                </div>
                                            </div>
                                        </template>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            `;

            // Aplikuj style
            this.applyStyles();

            // Dodaj obsługę Ctrl+Q
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'q') {
                    e.preventDefault();
                    Alpine.store('tmwp').toggleHidden();
                }
            });

            // Waliduj wszystkie okna przy resize przeglądarki
            window.addEventListener('resize', () => {
                const store = Alpine.store('tmwp');
                store.windows.forEach(win => {
                    const $el = $('#tmwp2-window-' + win.id);
                    if ($el.length) {
                        const offset = $el.offset();
                        const width = $el.outerWidth();
                        const height = $el.outerHeight();

                        // Waliduj pozycję
                        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
                        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
                        const margin = 10;

                        let x = offset.left;
                        let y = offset.top;

                        // Sprawdź granice
                        if (x < margin - width) x = margin - width + 50;
                        if (x > viewportWidth - margin) x = viewportWidth - margin - 50;
                        if (y < margin) y = margin;
                        if (y > viewportHeight - margin) y = viewportHeight - margin - 50;

                        // Skoryguj pozycję jeśli jest poza widokiem
                        if (x !== offset.left || y !== offset.top) {
                            $el.css({
                                top: y + 'px',
                                left: x + 'px'
                            });

                            // Zapisz nową pozycję
                            if (typeof GM_setValue !== 'undefined') {
                                GM_setValue('tmwp2_window_' + win.id + '_position', JSON.stringify({ x, y }));
                            }
                        }
                    }
                });
            });

            this.initialized = true;

            console.log('[TMWP2] Initialized - ready to start Alpine.js');

            return this.getAPI();
        };

        // Rejestruj komponenty Alpine
        this.registerComponents = function (components) {
            // Najpierw zarejestruj wbudowane komponenty TMWP2
            this.registerBuiltinComponents();

            // Następnie komponenty aplikacji
            for (const [name, component] of Object.entries(components)) {
                Alpine.data(name, component);
            }
        };

        // Funkcja walidacji granic okna (globalna dla TMWP2)
        this.validateWindowBounds = function (x, y, width, height) {
            const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            const margin = 10;

            // Sprawdź minimalne wymiary
            if (width <= 0) width = 400;
            if (height <= 0) height = 300;

            let validatedX = x;
            let validatedY = y;

            // Jeśli okno całkowicie poza prawą krawędzią
            if (x > viewportWidth - 50) {
                validatedX = viewportWidth - width - margin;
            }

            // Jeśli okno całkowicie poza lewą krawędzią
            if (x + width < 50) {
                validatedX = margin;
            }

            // Jeśli okno poza dolną krawędzią
            if (y > viewportHeight - 50) {
                validatedY = viewportHeight - height - margin;
            }

            // Jeśli okno poza górną krawędzią
            if (y < 0) {
                validatedY = margin;
            }

            return { x: validatedX, y: validatedY };
        };

        // Zarejestruj wbudowane komponenty TMWP2
        this.registerBuiltinComponents = function () {
            const self = this;

            // Alpine component dla okna
            Alpine.data('tmwp2Window', (win) => ({
                windowConfig: win,

                init() {
                    const windowConfig = this.windowConfig;
                    this.$nextTick(() => {
                        const $el = $('#tmwp2-window-' + windowConfig.id);
                        const $header = $('#tmwp2-header-' + windowConfig.id);

                        // Załaduj zapisaną pozycję i stan
                        let savedPosition = null;
                        let savedMinimized = false;
                        if (typeof localStorage !== 'undefined') {
                            const saved = localStorage.getItem('tmwp2_window_' + windowConfig.id + '_position');
                            if (saved) {
                                try {
                                    savedPosition = JSON.parse(saved);
                                } catch (e) { }
                            }
                            const savedMin = localStorage.getItem('tmwp2_window_' + windowConfig.id + '_minimized');
                            savedMinimized = savedMin === 'true' || savedMin === true;
                        }

                        // Przywróć stan zminimalizowania
                        if (savedMinimized) {
                            windowConfig.minimized = true;
                        }

                        /* if (windowConfig.minimized) {
                            $el.addClass('tmwp2-minimized');
                        } */

                        // Ustaw pozycję
                        if (savedPosition && savedPosition.left !== undefined && savedPosition.top !== undefined) {
                            const validated = Alpine.store('tmwp').validateWindowBounds({
                                x: savedPosition.left,
                                y: savedPosition.top,
                                width: $el.outerWidth() || parseInt(windowConfig.width) || 400,
                                height: $el.outerHeight() || parseInt(windowConfig.height) || 300
                            });
                            $el.css({
                                top: validated.y + 'px',
                                left: validated.x + 'px',
                                transform: 'none'
                            });
                        } else if (windowConfig.centered && !windowConfig.x && !windowConfig.y) {
                            $el.css({
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)'
                            });
                        } else if (windowConfig.x !== null && windowConfig.y !== null) {
                            const validated = Alpine.store('tmwp').validateWindowBounds({
                                x: parseInt(windowConfig.x),
                                y: parseInt(windowConfig.y),
                                width: $el.outerWidth() || parseInt(windowConfig.width) || 400,
                                height: $el.outerHeight() || parseInt(windowConfig.height) || 300
                            });
                            $el.css({
                                top: validated.y + 'px',
                                left: validated.x + 'px',
                                transform: 'none'
                            });
                        }

                        // Ustaw początkową klasę jeśli okno jest zminimalizowane
                        /* if (windowConfig.minimized) {
                            $el.addClass('tmwp2-minimized');
                        } */

                        // Draggable
                        if (windowConfig.draggable) {
                            $el.draggable({
                                containment: "document",
                                handle: $header,
                                cancel: "input, textarea, select, button",
                                scroll: false,
                                start: () => {
                                    $header.addClass('tmwp2-dragged');
                                    // Usuń transform przy rozpoczęciu
                                    const offset = $el.offset();
                                    $el.css({
                                        top: offset.top + 'px',
                                        left: offset.left + 'px',
                                        transform: 'none'
                                    });
                                },
                                drag: (event, ui) => {
                                    // Synchronizuj podczas przeciągania
                                    if (typeof localStorage !== 'undefined') {
                                        localStorage.setItem('tmwp2_window_' + windowConfig.id + '_position', JSON.stringify({
                                            left: ui.position.left,
                                            top: ui.position.top
                                        }));
                                    }
                                },
                                stop: () => {
                                    $header.removeClass('tmwp2-dragged');
                                    // Zapisz pozycję
                                    const offset = $el.offset();
                                    if (typeof localStorage !== 'undefined') {
                                        // Zapisz pozycję do localStorage
                                        localStorage.setItem('tmwp2_window_' + windowConfig.id + '_position', JSON.stringify({
                                            left: offset.left,
                                            top: offset.top
                                        }));
                                    }
                                }
                            });
                        }

                        // Resizable
                        if (windowConfig.resizable) {
                            $el.resizable({
                                handles: "n, e, s, w, se, sw, ne, nw",
                                resize: (event, ui) => {
                                    // Synchronizuj podczas zmiany rozmiaru
                                    if (typeof localStorage !== 'undefined') {
                                        localStorage.setItem('tmwp2_window_' + windowConfig.id + '_position', JSON.stringify({
                                            left: ui.position.left,
                                            top: ui.position.top
                                        }));
                                        localStorage.setItem('tmwp2_window_' + windowConfig.id + '_size', JSON.stringify({
                                            width: ui.size.width + 'px',
                                            height: ui.size.height + 'px'
                                        }));
                                    }
                                },
                                stop: (event, ui) => {
                                    // Zapisz rozmiar i pozycję
                                    const offset = $el.offset();
                                    if (typeof localStorage !== 'undefined') {
                                        localStorage.setItem('tmwp2_window_' + windowConfig.id + '_position', JSON.stringify({
                                            left: offset.left,
                                            top: offset.top
                                        }));
                                        localStorage.setItem('tmwp2_window_' + windowConfig.id + '_size', JSON.stringify({
                                            width: ui.size.width + 'px',
                                            height: ui.size.height + 'px'
                                        }));
                                    }
                                }
                            });
                        }

                        // Obserwuj zmiany w minimized
                        this.$watch('windowConfig.minimized', (minimized) => {
                            if (minimized) {
                                $el.addClass('tmwp2-minimized');
                                // Wyłącz resizable
                                if ($el.resizable('instance')) {
                                    $el.resizable('disable');
                                }
                            } else {
                                $el.removeClass('tmwp2-minimized');
                                // Włącz resizable
                                if ($el.resizable('instance')) {
                                    $el.resizable('enable');
                                }
                            }

                            // Zapisz stan zminimalizowania
                            if (typeof localStorage !== 'undefined') {
                                localStorage.setItem('tmwp2_window_' + windowConfig.id + '_minimized', minimized);
                            }
                        });

                        // Nasłuchuj zmian z innych kart
                        window.addEventListener('storage', (e) => {
                            if (e.key === 'tmwp2_window_' + windowConfig.id + '_position' && e.newValue) {
                                try {
                                    const pos = JSON.parse(e.newValue);
                                    const currentOffset = $el.offset();
                                    
                                    // Aktualizuj tylko jeśli pozycja się zmieniła
                                    if (currentOffset.left !== pos.left || currentOffset.top !== pos.top) {
                                        $el.css({
                                            left: pos.left + 'px',
                                            top: pos.top + 'px',
                                            transform: 'none'
                                        });
                                    }
                                } catch (err) {
                                    console.warn('[TMWP2] Failed to sync position:', err);
                                }
                            } else if (e.key === 'tmwp2_window_' + windowConfig.id + '_size' && e.newValue) {
                                try {
                                    const size = JSON.parse(e.newValue);
                                    const currentWidth = $el.outerWidth() + 'px';
                                    const currentHeight = $el.outerHeight() + 'px';
                                    
                                    // Aktualizuj tylko jeśli rozmiar się zmienił
                                    if (currentWidth !== size.width || currentHeight !== size.height) {
                                        $el.css({
                                            width: size.width,
                                            height: size.height
                                        });
                                    }
                                } catch (err) {
                                    console.warn('[TMWP2] Failed to sync size:', err);
                                }
                            } else if (e.key === 'tmwp2_window_' + windowConfig.id + '_minimized' && e.newValue !== null) {
                                const isMinimized = e.newValue === 'true';
                                if (windowConfig.minimized !== isMinimized) {
                                    windowConfig.minimized = isMinimized;
                                }
                            }
                        });
                    });
                },

                closeWindow(id) {
                    Alpine.store('tmwp').removeWindow(id);
                }
            }));

            // Alpine component dla menu kontekstowego
            Alpine.data('tmwp2ContextMenu', () => ({
                activeSubmenu: null,

                get items() {
                    return Alpine.store('tmwp').contextMenu?.items || [];
                },

                handleMenuClick(item) {
                    if (item.disabled || item.separator) return;

                    if (item.action) {
                        item.action();
                    }

                    if (!item.submenu) {
                        Alpine.store('tmwp').hideMenu();
                    }
                },

                checkSubmenuPosition(submenuEl) {
                    if (!submenuEl) return;

                    // Najpierw ustaw domyślną pozycję (po prawej)
                    submenuEl.style.left = '100%';
                    submenuEl.style.right = 'auto';
                    submenuEl.style.marginLeft = '2px';
                    submenuEl.style.marginRight = '0';

                    // Pozwól submenu się wyrenderować, potem sprawdź pozycję
                    requestAnimationFrame(() => {
                        const rect = submenuEl.getBoundingClientRect();
                        const viewportWidth = window.innerWidth;

                        // Jeśli submenu wychodzi poza prawą krawędź, przenieś po lewej
                        if (rect.right > viewportWidth - 10) {
                            submenuEl.style.left = 'auto';
                            submenuEl.style.right = '100%';
                            submenuEl.style.marginLeft = '0';
                            submenuEl.style.marginRight = '2px';
                        }
                    });
                }
            }));
        };

        // Helper functions dla Alpine
        targetWindow.windowStyle = function (window) {
            return {
                position: 'fixed',
                left: window.x + 'px',
                top: window.y + 'px',
                width: window.width,
                height: window.height,
                zIndex: 1000000010
            };
        };

        targetWindow.menuStyle = function () {
            const menu = Alpine.store('tmwp').contextMenu;
            if (!menu) return {};

            // Sprawdź czy menu nie wychodzi poza viewport
            let x = menu.x;
            let y = menu.y;

            // Oszacuj szerokość menu (będziemy mierzyć później)
            const estimatedWidth = 200;
            const estimatedHeight = 300;

            // Sprawdź prawą krawędź
            if (x + estimatedWidth > window.innerWidth) {
                x = window.innerWidth - estimatedWidth - 10;
            }

            // Sprawdź lewą krawędź
            if (x < 0) {
                x = 10;
            }

            // Sprawdź dolną krawędź
            if (y + estimatedHeight > window.innerHeight) {
                y = window.innerHeight - estimatedHeight - 10;
            }

            // Sprawdź górną krawędź
            if (y < 0) {
                y = 10;
            }

            return {
                position: 'fixed',
                top: y + 'px',
                left: x + 'px',
                zIndex: 1000000050
            };
        };

        targetWindow.getComponent = function (componentName) {
            // Zwraca dane komponentu Alpine
            return componentName || {};
        };

        // Aplikuj style
        this.applyStyles = function () {
            _gm_addStyle(`
                /* Window Styles */
                .tmwp2-window {
                    font-family: Arial, Helvetica, sans-serif;
                    color: black;
                    display: flex;
                    flex-direction: column;
                    background-color: white;
                    border: 1px grey solid;
                    border-radius: 0.5em;
                    box-shadow: 0.5em 0.5em 1em #88888888;
                    overflow: hidden;
                }

                .tmwp2-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: linear-gradient(180deg, #f0f0f0 0%, #d0d0d0 100%);
                    border-bottom: 1px grey solid;
                    padding: 0.5em;
                    cursor: move;
                    user-select: none;
                }

                .tmwp2-header.tmwp2-dragged {
                    cursor: grabbing;
                }

                .tmwp2-title {
                    flex: 1;
                    font-weight: bold;
                    font-size: 14px;
                }

                .tmwp2-icons {
                    display: flex;
                    gap: 0.5em;
                }

                .tmwp2-close {
                    cursor: pointer;
                    padding: 0 0.5em;
                    font-weight: bold;
                }

                .tmwp2-close:hover {
                    background-color: #ff4444;
                    color: white;
                    border-radius: 3px;
                }

                .tmwp2-content {
                    flex: 1;
                    padding: 1em;
                    overflow: auto;
                }

                .tmwp2-footer {
                    border-top: 1px solid #ccc;
                    padding: 0.5em 1em;
                    background-color: #f5f5f5;
                }

                /* Context Menu Styles */
                .tmwp2-context-menu,
                .tmwp2-menu-submenu {
                    background-color: #f0f0f0;
                    border: 1px solid #999;
                    border-radius: 4px;
                    box-shadow: 2px 2px 8px rgba(0,0,0,0.3);
                    min-width: 160px;
                    padding: 2px 0;
                    font-family: Arial, Helvetica, sans-serif;
                    font-size: 13px;
                    color: #000 !important;
                }

                .tmwp2-menu-item {
                    padding: 4px 24px 4px 8px;
                    cursor: pointer;
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    user-select: none;
                    color: #000 !important;
                }

                .tmwp2-menu-item:hover {
                    background-color: #0078d4;
                    color: white !important;
                }

                .tmwp2-menu-item-disabled {
                    color: #999 !important;
                    cursor: not-allowed;
                }

                .tmwp2-menu-item-disabled:hover {
                    background-color: transparent;
                    color: #999 !important;
                }

                .tmwp2-menu-icon {
                    width: 16px;
                    text-align: center;
                    flex-shrink: 0;
                }

                .tmwp2-menu-label {
                    flex: 1;
                    color: inherit;
                }

                .tmwp2-menu-arrow {
                    position: absolute;
                    right: 6px;
                    font-size: 10px;
                    color: inherit;
                }

                .tmwp2-menu-separator {
                    height: 1px;
                    background-color: #ccc;
                    margin: 2px 0;
                }

                .tmwp2-menu-submenu {
                    position: absolute;
                    left: 100%;
                    top: -2px;
                    margin-left: 2px;
                }

                /* jQuery UI Resizable handles */
                .ui-resizable-handle {
                    position: absolute;
                    font-size: 0.1px;
                    display: block;
                }

                .ui-resizable-n {
                    cursor: n-resize;
                    height: 7px;
                    width: 100%;
                    top: -5px;
                    left: 0;
                }

                .ui-resizable-s {
                    cursor: s-resize;
                    height: 7px;
                    width: 100%;
                    bottom: -5px;
                    left: 0;
                }

                .ui-resizable-e {
                    cursor: e-resize;
                    width: 7px;
                    right: -5px;
                    top: 0;
                    height: 100%;
                }

                .ui-resizable-w {
                    cursor: w-resize;
                    width: 7px;
                    left: -5px;
                    top: 0;
                    height: 100%;
                }

                .ui-resizable-se {
                    cursor: se-resize;
                    width: 12px;
                    height: 12px;
                    right: 1px;
                    bottom: 1px;
                }

                .ui-resizable-sw {
                    cursor: sw-resize;
                    width: 9px;
                    height: 9px;
                    left: -5px;
                    bottom: -5px;
                }

                .ui-resizable-nw {
                    cursor: nw-resize;
                    width: 9px;
                    height: 9px;
                    left: -5px;
                    top: -5px;
                }

                .ui-resizable-ne {
                    cursor: ne-resize;
                    width: 9px;
                    height: 9px;
                    right: -5px;
                    top: -5px;
                }
            `);
        };

        // Zwróć API
        this.getAPI = function () {
            return {
                createWindow: (config) => Alpine.store('tmwp').addWindow(config),
                showContextMenu: (items, x, y) => Alpine.store('tmwp').showMenu(items, x, y),
                hideContextMenu: () => Alpine.store('tmwp').hideMenu(),
                removeWindow: (id) => Alpine.store('tmwp').removeWindow(id),
                toggleHidden: () => Alpine.store('tmwp').toggleHidden(),
                start: () => {
                    if (typeof Alpine.start === 'function') {
                        // Alpine.start();
                        console.log('[TMWP2] Alpine.js started');
                    }
                }
            };
        };

        const initEvent = new CustomEvent('tmwp2:init', {
            detail: {
                version: '1.0.0',
                status: 'ready',
                timestamp: Date.now()
            },
            bubbles: true,
            cancelable: true
        });

        targetWindow.dispatchEvent(initEvent);

    };

    // Udostępnij globalnie
    targetWindow._tmwp2 = new TMWP2();

    console.log('[TMWP2] Loaded - Alpine.js Window Manager v0.6.0');

})();

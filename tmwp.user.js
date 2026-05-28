// ==UserScript==
// @name         The Monkey Window Project 2
// @namespace    rluczak.dev
// @supportURL   https://github.com/sharkson-mgn/TheMonkeyWindowProject
// @downloadURL  https://github.com/sharkson-mgn/TheMonkeyWindowProject/raw/main/tmwp.user.js
// @updateURL    https://github.com/sharkson-mgn/TheMonkeyWindowProject/raw/main/tmwp.user.js
// @version      1.0.5
// @description  [TMWP] Alpine.js based window manager for userscripts
// @author       sharkson-mgn
// @match        *://*/*
// @require      https://code.jquery.com/jquery-4.0.0.min.js
// @require      https://code.jquery.com/ui/1.14.2/jquery-ui.min.js
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// @noframes
// @run-at       document-end
// ==/UserScript==
// @require      https://cdn.jsdelivr.net/npm/alpinejs@3.15.11/dist/cdn.min.js

(function () {
    'use strict';

    const _log = (...args) => {
        if (true) {
            return;
        }
        console.log(...args);
    };

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

    try {
        const window = window ?? targetWindow;
    } catch (e) { }

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
                        width: window.innerWidth || document.documentElement.clientWidth,
                        height: window.innerHeight || document.documentElement.clientHeight
                    };
                    const margin = 10;

                    // 1. Parsuj rozmiary (usuwając 'px' jeśli jest)
                    let width = parseInt(String(config.width).replace('px', '')) || 400;
                    let height = parseInt(String(config.height).replace('px', '')) || 300;

                    // Parsuj pozycje
                    let x = (config.x !== null && config.x !== undefined) ? parseInt(String(config.x).replace('px', '')) : null;
                    let y = (config.y !== null && config.y !== undefined) ? parseInt(String(config.y).replace('px', '')) : null;

                    // 2. Walidacja wymiarów (żeby okno nie było większe niż ekran)
                    // Minimalne wymiary (np. 150px żeby okno nie zniknęło całkowicie)
                    if (width < 150) width = 150;
                    if (height < 100) height = 100;

                    // Maksymalne wymiary (rozmiar ekranu minus marginesy z obu stron)
                    const maxWidth = viewport.width - (margin * 2);
                    const maxHeight = viewport.height - (margin * 2);

                    if (width > maxWidth) width = maxWidth;
                    if (height > maxHeight) height = maxHeight;

                    // 3. Walidacja pozycji (skoro element jest FIXED, sprawdzamy względem viewportu)
                    if (x !== null && y !== null) {
                        // Lewa krawędź
                        if (x < margin) x = margin;

                        // Górna krawędź
                        if (y < margin) y = margin;

                        // Prawa krawędź (używamy już zwalidowanej szerokości)
                        if (x + width > viewport.width - margin) {
                            x = viewport.width - width - margin;
                        }

                        // Dolna krawędź (używamy już zwalidowanej wysokości)
                        if (y + height > viewport.height - margin) {
                            y = viewport.height - height - margin;
                        }

                        // Finalny "failsafe" - jeśli po wszystkich korektach x/y nadal są ujemne 
                        // (co może się zdarzyć na bardzo małych ekranach), wymuszamy wyśrodkowanie
                        if (x < 0 || y < 0) {
                            x = null;
                            y = null;
                        }
                    }

                    return {
                        ...config,
                        width: width + 'px',
                        height: height + 'px',
                        x: x !== null ? x : null,
                        y: y !== null ? y : null,
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
                        const rect = $el[0].getBoundingClientRect();
                        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
                        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
                        const margin = 10;

                        // 1. Ogranicz wymiary (żeby okno nie było większe niż ekran)
                        let width = $el.outerWidth();
                        let height = $el.outerHeight();
                        let sizeChanged = false;

                        const maxWidth = viewportWidth - (margin * 2);
                        const maxHeight = viewportHeight - (margin * 2);

                        if (width > maxWidth) {
                            width = maxWidth;
                            sizeChanged = true;
                        }
                        if (height > maxHeight) {
                            height = maxHeight;
                            sizeChanged = true;
                        }

                        if (sizeChanged) {
                            $el.css({
                                width: width + 'px',
                                height: height + 'px'
                            });
                        }

                        // 2. Waliduj pozycję (po ewentualnej zmianie wymiarów)
                        let x = rect.left;
                        let y = rect.top;
                        let posChanged = false;

                        if (x < margin) {
                            x = margin;
                            posChanged = true;
                        }
                        if (x + width > viewportWidth - margin) {
                            x = viewportWidth - width - margin;
                            posChanged = true;
                        }
                        if (y < margin) {
                            y = margin;
                            posChanged = true;
                        }
                        if (y + height > viewportHeight - margin) {
                            y = viewportHeight - height - margin;
                            posChanged = true;
                        }

                        // 3. Zastosuj zmiany pozycji
                        if (posChanged) {
                            $el.css({
                                top: y + 'px',
                                left: x + 'px'
                            });
                        }

                        // 4. Zapisz nowe parametry (jeśli cokolwiek się zmieniło)
                        if ((posChanged || sizeChanged) && typeof GM_setValue !== 'undefined') {
                            GM_setValue('tmwp2_window_' + win.id + '_position', JSON.stringify({
                                x,
                                y,
                                width,
                                height
                            }));
                        }
                    }
                });
            });

            this.initialized = true;

            _log('[TMWP2] Initialized - ready to start Alpine.js');

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

            // 1. Walidacja wymiarów (żeby okno nie było większe niż ekran)
            let validatedWidth = width || 400;
            let validatedHeight = height || 300;

            // Maksymalne dopuszczalne wymiary (ekran minus marginesy)
            const maxWidth = viewportWidth - (margin * 2);
            const maxHeight = viewportHeight - (margin * 2);

            if (validatedWidth > maxWidth) validatedWidth = maxWidth;
            if (validatedHeight > maxHeight) validatedHeight = maxHeight;

            // Minimalne rozsądne wymiary
            if (validatedWidth < 100) validatedWidth = 100;
            if (validatedHeight < 100) validatedHeight = 100;

            // 2. Walidacja pozycji (z uwzględnieniem pozycji FIXED)
            let validatedX = x;
            let validatedY = y;

            // Sprawdź lewą krawędź
            if (validatedX < margin) {
                validatedX = margin;
            }

            // Sprawdź prawą krawędź (używamy szerokości okna)
            if (validatedX + validatedWidth > viewportWidth - margin) {
                validatedX = viewportWidth - validatedWidth - margin;
            }

            // Sprawdź górną krawędź
            if (validatedY < margin) {
                validatedY = margin;
            }

            // Sprawdź dolną krawędź (używamy wysokości okna)
            if (validatedY + validatedHeight > viewportHeight - margin) {
                validatedY = viewportHeight - validatedHeight - margin;
            }

            // Zwracamy wszystko, bo szerokość/wysokość mogły ulec zmianie
            return {
                x: validatedX,
                y: validatedY,
                width: validatedWidth,
                height: validatedHeight
            };
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
                                width: validated.width + 'px',
                                height: validated.height + 'px',
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
                                width: validated.width + 'px',
                                height: validated.height + 'px',
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
                                    const offset = $el[0].getBoundingClientRect();
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
                                    const offset = $el[0].getBoundingClientRect();
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
                                    const offset = $el[0].getBoundingClientRect();
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
                                    const currentOffset = $el[0].getBoundingClientRect();

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
        targetWindow.windowStyle = function (win) {
            const savedSize = localStorage.getItem('tmwp2_window_' + win.id + '_size') ? JSON.parse(localStorage.getItem('tmwp2_window_' + win.id + '_size')) : { width: win.width, height: win.height };
            return {
                position: 'fixed',
                /* left: win.x + 'px',
                top: win.y + 'px', */
                left: localStorage.getItem('tmwp2_window_' + win.id + '_position') ? JSON.parse(localStorage.getItem('tmwp2_window_' + win.id + '_position')).left + 'px' : (win.x !== null && win.x !== undefined ? win.x + 'px' : '50%'),
                top: localStorage.getItem('tmwp2_window_' + win.id + '_position') ? JSON.parse(localStorage.getItem('tmwp2_window_' + win.id + '_position')).top + 'px' : (win.y !== null && win.y !== undefined ? win.y + 'px' : '50%'),
                width: !win.minimized ? savedSize.width : null,
                height: !win.minimized ? savedSize.height : null,
                /* width: win.minimized ? localStorage.getItem('tmwp2_window_' + win.id + '_size') ? JSON.parse(localStorage.getItem('tmwp2_window_' + win.id + '_size')).width : win.width : null,
                height: win.minimized ? localStorage.getItem('tmwp2_window_' + win.id + '_size') ? JSON.parse(localStorage.getItem('tmwp2_window_' + win.id + '_size')).height : win.height : null, */
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
                        _log('[TMWP2] Alpine.js started');
                    }
                }
            };
        };

    };

    document.addEventListener("alpine:init", () => {

        // Udostępnij globalnie
        targetWindow._tmwp2 = new TMWP2();

        const initEvent = new CustomEvent('tmwp2:init', {
            detail: {
                version: '1.0.0',
                status: 'ready',
                timestamp: Date.now()
            },
            bubbles: true,
            cancelable: true
        });

        document.addEventListener("tmwp2:init", () => {
            _log('[TMWP2] tmwp2:init event dispatched');
        });

        document.dispatchEvent(initEvent);

        _log('[TMWP2] Loaded - Alpine.js Window Manager v0.6.0');

    });

    (() => {

        if (targetWindow.Alpine) {
            console.warn('Alpine.js is already loaded');
            return;
        }

        (() => {
            var ee = !1, re = !1, W = [], ne = -1, ie = !1; function Ve(t) { Dn(t) } function Ue() { ie = !0 } function Ke() { ie = !1, We() } function Dn(t) { W.includes(t) || W.push(t), We() } function qe(t) { let e = W.indexOf(t); e !== -1 && e > ne && W.splice(e, 1) } function We() { if (!re && !ee) { if (ie) return; ee = !0, queueMicrotask(kn) } } function kn() { ee = !1, re = !0; for (let t = 0; t < W.length; t++)W[t](), ne = t; W.length = 0, ne = -1, re = !1 } var C, R, j, se, oe = !0; function Ge(t) { oe = !1, t(), oe = !0 } function Je(t) { C = t.reactive, j = t.release, R = e => t.effect(e, { scheduler: r => { oe ? Ve(r) : r() } }), se = t.raw } function ae(t) { R = t } function Ye(t) { let e = () => { }; return [n => { let i = R(n); return t._x_effects || (t._x_effects = new Set, t._x_runEffects = () => { t._x_effects.forEach(o => o()) }), t._x_effects.add(i), e = () => { i !== void 0 && (t._x_effects.delete(i), j(i)) }, i }, () => { e() }] } function St(t, e) { let r = !0, n, i, o = R(() => { let s = t(), a = JSON.stringify(s); if (!r && (typeof s == "object" || s !== n)) { let c = typeof n == "object" ? JSON.parse(i) : n; queueMicrotask(() => { e(s, c) }) } n = s, i = a, r = !1 }); return () => j(o) } async function Xe(t) { Ue(); try { await t(), await Promise.resolve() } finally { Ke() } } var Ze = [], Qe = [], tr = []; function er(t) { tr.push(t) } function et(t, e) { typeof e == "function" ? (t._x_cleanups || (t._x_cleanups = []), t._x_cleanups.push(e)) : (e = t, Qe.push(e)) } function At(t) { Ze.push(t) } function Ot(t, e, r) { t._x_attributeCleanups || (t._x_attributeCleanups = {}), t._x_attributeCleanups[e] || (t._x_attributeCleanups[e] = []), t._x_attributeCleanups[e].push(r) } function ce(t, e) { t._x_attributeCleanups && Object.entries(t._x_attributeCleanups).forEach(([r, n]) => { (e === void 0 || e.includes(r)) && (n.forEach(i => i()), delete t._x_attributeCleanups[r]) }) } function rr(t) { for (t._x_effects?.forEach(qe); t._x_cleanups?.length;)t._x_cleanups.pop()() } var ue = new MutationObserver(pe), le = !1; function lt() { ue.observe(document, { subtree: !0, childList: !0, attributes: !0, attributeOldValue: !0 }), le = !0 } function fe() { In(), ue.disconnect(), le = !1 } var ut = []; function In() { let t = ue.takeRecords(); ut.push(() => t.length > 0 && pe(t)); let e = ut.length; queueMicrotask(() => { if (ut.length === e) for (; ut.length > 0;)ut.shift()() }) } function m(t) { if (!le) return t(); fe(); let e = t(); return lt(), e } var de = !1, vt = []; function nr() { de = !0 } function ir() { de = !1, pe(vt), vt = [] } function pe(t) { if (de) { vt = vt.concat(t); return } let e = [], r = new Set, n = new Map, i = new Map; for (let o = 0; o < t.length; o++)if (!t[o].target._x_ignoreMutationObserver && (t[o].type === "childList" && (t[o].removedNodes.forEach(s => { s.nodeType === 1 && s._x_marker && r.add(s) }), t[o].addedNodes.forEach(s => { if (s.nodeType === 1) { if (r.has(s)) { r.delete(s); return } s._x_marker || e.push(s) } })), t[o].type === "attributes")) { let s = t[o].target, a = t[o].attributeName, c = t[o].oldValue, u = () => { n.has(s) || n.set(s, []), n.get(s).push({ name: a, value: s.getAttribute(a) }) }, l = () => { i.has(s) || i.set(s, []), i.get(s).push(a) }; s.hasAttribute(a) && c === null ? u() : s.hasAttribute(a) ? (l(), u()) : l() } i.forEach((o, s) => { ce(s, o) }), n.forEach((o, s) => { Ze.forEach(a => a(s, o)) }); for (let o of r) e.some(s => s.contains(o)) || Qe.forEach(s => s(o)); for (let o of e) o.isConnected && tr.forEach(s => s(o)); e = null, r = null, n = null, i = null } function Ct(t) { return P(F(t)) } function N(t, e, r) { return t._x_dataStack = [e, ...F(r || t)], () => { t._x_dataStack = t._x_dataStack.filter(n => n !== e) } } function F(t) { return t._x_dataStack ? t._x_dataStack : typeof ShadowRoot == "function" && t instanceof ShadowRoot ? F(t.host) : t.parentNode ? F(t.parentNode) : [] } function P(t) { return new Proxy({ objects: t }, $n) } function or(t, e) { return t === null || t === Object.prototype ? null : Object.prototype.hasOwnProperty.call(t, e) ? t : or(Object.getPrototypeOf(t), e) } var $n = { ownKeys({ objects: t }) { return Array.from(new Set(t.flatMap(e => Object.keys(e)))) }, has({ objects: t }, e) { return e == Symbol.unscopables ? !1 : t.some(r => Object.prototype.hasOwnProperty.call(r, e) || Reflect.has(r, e)) }, get({ objects: t }, e, r) { return e == "toJSON" ? Ln : Reflect.get(t.find(n => Reflect.has(n, e)) || {}, e, r) }, set({ objects: t }, e, r, n) { let i; for (let s of t) if (i = or(s, e), i) break; i || (i = t[t.length - 1]); let o = Object.getOwnPropertyDescriptor(i, e); return o?.set && o?.get ? o.set.call(n, r) || !0 : Reflect.set(i, e, r) } }; function Ln() { return Reflect.ownKeys(this).reduce((e, r) => (e[r] = Reflect.get(this, r), e), {}) } function rt(t) { let e = n => typeof n == "object" && !Array.isArray(n) && n !== null, r = (n, i = "") => { Object.entries(Object.getOwnPropertyDescriptors(n)).forEach(([o, { value: s, enumerable: a }]) => { if (a === !1 || s === void 0 || typeof s == "object" && s !== null && s.__v_skip) return; let c = i === "" ? o : `${i}.${o}`; typeof s == "object" && s !== null && s._x_interceptor ? n[o] = s.initialize(t, c, o) : e(s) && s !== n && !(s instanceof Element) && r(s, c) }) }; return r(t) } function Tt(t, e = () => { }) { let r = { initialValue: void 0, _x_interceptor: !0, initialize(n, i, o) { return t(this.initialValue, () => jn(n, i), s => me(n, i, s), i, o) } }; return e(r), n => { if (typeof n == "object" && n !== null && n._x_interceptor) { let i = r.initialize.bind(r); r.initialize = (o, s, a) => { let c = n.initialize(o, s, a); return r.initialValue = c, i(o, s, a) } } else r.initialValue = n; return r } } function jn(t, e) { return e.split(".").reduce((r, n) => r[n], t) } function me(t, e, r) { if (typeof e == "string" && (e = e.split(".")), e.length === 1) t[e[0]] = r; else { if (e.length === 0) throw error; return t[e[0]] || (t[e[0]] = {}), me(t[e[0]], e.slice(1), r) } } var sr = {}; function x(t, e) { sr[t] = e } function H(t, e) { let r = Fn(e); return Object.entries(sr).forEach(([n, i]) => { Object.defineProperty(t, `$${n}`, { get() { return i(e, r) }, enumerable: !1 }) }), t } function Fn(t) { let [e, r] = he(t), n = { interceptor: Tt, ...e }; return et(t, r), n } function ar(t, e, r, ...n) { try { return r(...n) } catch (i) { nt(i, t, e) } } function nt(...t) { return cr(...t) } var cr = Bn; function ur(t) { cr = t } function Bn(t, e, r = void 0) {
                t = Object.assign(t ?? { message: "No error message given." }, { el: e, expression: r }), console.warn(`Alpine Expression Error: ${t.message}

${r ? 'Expression: "' + r + `"

`: ""}`, e), setTimeout(() => { throw t }, 0)
            } var it = !0; function Mt(t) { let e = it; it = !1; let r = t(); return it = e, r } function T(t, e, r = {}) { let n; return _(t, e)(i => n = i, r), n } function _(...t) { return lr(...t) } var lr = () => { }; function fr(t) { lr = t } var dr; function pr(t) { dr = t } function mr(t, e) { let r = {}; H(r, t); let n = [r, ...F(t)], i = typeof e == "function" ? zn(n, e) : Vn(n, e, t); return ar.bind(null, t, e, i) } function zn(t, e) { return (r = () => { }, { scope: n = {}, params: i = [], context: o } = {}) => { if (!it) { ft(r, e, P([n, ...t]), i); return } let s = e.apply(P([n, ...t]), i); ft(r, s) } } var _e = {}; function Hn(t, e) { if (_e[t]) return _e[t]; let r = Object.getPrototypeOf(async function () { }).constructor, n = /^[\n\s]*if.*\(.*\)/.test(t.trim()) || /^(let|const)\s/.test(t.trim()) ? `(async()=>{ ${t} })()` : t, o = (() => { try { let s = new r(["__self", "scope"], `with (scope) { __self.result = ${n} }; __self.finished = true; return __self.result;`); return Object.defineProperty(s, "name", { value: `[Alpine] ${t}` }), s } catch (s) { return nt(s, e, t), Promise.resolve() } })(); return _e[t] = o, o } function Vn(t, e, r) { let n = Hn(e, r); return (i = () => { }, { scope: o = {}, params: s = [], context: a } = {}) => { n.result = void 0, n.finished = !1; let c = P([o, ...t]); if (typeof n == "function") { let u = n.call(a, n, c).catch(l => nt(l, r, e)); n.finished ? (ft(i, n.result, c, s, r), n.result = void 0) : u.then(l => { ft(i, l, c, s, r) }).catch(l => nt(l, r, e)).finally(() => n.result = void 0) } } } function ft(t, e, r, n, i) { if (it && typeof e == "function") { let o = e.apply(r, n); o instanceof Promise ? o.then(s => ft(t, s, r, n)).catch(s => nt(s, i, e)) : t(o) } else typeof e == "object" && e instanceof Promise ? e.then(o => t(o)) : t(e) } function hr(...t) { return dr(...t) } function _r(t, e, r = {}) { let n = {}; H(n, t); let i = [n, ...F(t)], o = P([r.scope ?? {}, ...i]), s = r.params ?? []; if (e.includes("await")) { let a = Object.getPrototypeOf(async function () { }).constructor, c = /^[\n\s]*if.*\(.*\)/.test(e.trim()) || /^(let|const)\s/.test(e.trim()) ? `(async()=>{ ${e} })()` : e; return new a(["scope"], `with (scope) { let __result = ${c}; return __result }`).call(r.context, o) } else { let a = /^[\n\s]*if.*\(.*\)/.test(e.trim()) || /^(let|const)\s/.test(e.trim()) ? `(()=>{ ${e} })()` : e, u = new Function(["scope"], `with (scope) { let __result = ${a}; return __result }`).call(r.context, o); return typeof u == "function" && it ? u.apply(o, s) : u } } var ye = "x-"; function O(t = "") { return ye + t } function gr(t) { ye = t } var Rt = {}; function p(t, e) { return Rt[t] = e, { before(r) { if (!Rt[r]) { console.warn(String.raw`Cannot find directive \`${r}\`. \`${t}\` will use the default order of execution`); return } let n = G.indexOf(r); G.splice(n >= 0 ? n : G.indexOf("DEFAULT"), 0, t) } } } function xr(t) { return Object.keys(Rt).includes(t) } function pt(t, e, r) { if (e = Array.from(e), t._x_virtualDirectives) { let o = Object.entries(t._x_virtualDirectives).map(([a, c]) => ({ name: a, value: c })), s = be(o); o = o.map(a => s.find(c => c.name === a.name) ? { name: `x-bind:${a.name}`, value: `"${a.value}"` } : a), e = e.concat(o) } let n = {}; return e.map(wr((o, s) => n[o] = s)).filter(Sr).map(Kn(n, r)).sort(qn).map(o => Un(t, o)) } function be(t) { return Array.from(t).map(wr()).filter(e => !Sr(e)) } var ge = !1, dt = new Map, yr = Symbol(); function br(t) { ge = !0; let e = Symbol(); yr = e, dt.set(e, []); let r = () => { for (; dt.get(e).length;)dt.get(e).shift()(); dt.delete(e) }, n = () => { ge = !1, r() }; t(r), n() } function he(t) { let e = [], r = a => e.push(a), [n, i] = Ye(t); return e.push(i), [{ Alpine: B, effect: n, cleanup: r, evaluateLater: _.bind(_, t), evaluate: T.bind(T, t) }, () => e.forEach(a => a())] } function Un(t, e) { let r = () => { }, n = Rt[e.type] || r, [i, o] = he(t); Ot(t, e.original, o); let s = () => { t._x_ignore || t._x_ignoreSelf || (n.inline && n.inline(t, e, i), n = n.bind(n, t, e, i), ge ? dt.get(yr).push(n) : n()) }; return s.runCleanups = o, s } var Nt = (t, e) => ({ name: r, value: n }) => (r.startsWith(t) && (r = r.replace(t, e)), { name: r, value: n }), Pt = t => t; function wr(t = () => { }) { return ({ name: e, value: r }) => { let { name: n, value: i } = Er.reduce((o, s) => s(o), { name: e, value: r }); return n !== e && t(n, e), { name: n, value: i } } } var Er = []; function ot(t) { Er.push(t) } function Sr({ name: t }) { return vr().test(t) } var vr = () => new RegExp(`^${ye}([^:^.]+)\\b`); function Kn(t, e) { return ({ name: r, value: n }) => { r === n && (n = ""); let i = r.match(vr()), o = r.match(/:([a-zA-Z0-9\-_:]+)/), s = r.match(/\.[^.\]]+(?=[^\]]*$)/g) || [], a = e || t[r] || r; return { type: i ? i[1] : null, value: o ? o[1] : null, modifiers: s.map(c => c.replace(".", "")), expression: n, original: a } } } var xe = "DEFAULT", G = ["ignore", "ref", "data", "id", "anchor", "bind", "init", "for", "model", "modelable", "transition", "show", "if", xe, "teleport"]; function qn(t, e) { let r = G.indexOf(t.type) === -1 ? xe : t.type, n = G.indexOf(e.type) === -1 ? xe : e.type; return G.indexOf(r) - G.indexOf(n) } function J(t, e, r = {}, n = {}) { return t.dispatchEvent(new CustomEvent(e, { detail: r, bubbles: !0, composed: !0, cancelable: !0, ...n })) } function D(t, e) { if (typeof ShadowRoot == "function" && t instanceof ShadowRoot) { Array.from(t.children).forEach(i => D(i, e)); return } let r = !1; if (e(t, () => r = !0), r) return; let n = t.firstElementChild; for (; n;)D(n, e, !1), n = n.nextElementSibling } function S(t, ...e) { console.warn(`Alpine Warning: ${t}`, ...e) } var Ar = !1; function Or() { Ar && S("Alpine has already been initialized on this page. Calling Alpine.start() more than once can cause problems."), Ar = !0, document.body || S("Unable to initialize. Trying to load Alpine before `<body>` is available. Did you forget to add `defer` in Alpine's `<script>` tag?"), J(document, "alpine:init"), J(document, "alpine:initializing"), lt(), er(e => v(e, D)), et(e => k(e)), At((e, r) => { pt(e, r).forEach(n => n()) }); let t = e => !Y(e.parentElement, !0); Array.from(document.querySelectorAll(Mr().join(","))).filter(t).forEach(e => { v(e) }), J(document, "alpine:initialized"), setTimeout(() => { Gn() }) } var we = [], Cr = []; function Tr() { return we.map(t => t()) } function Mr() { return we.concat(Cr).map(t => t()) } function Dt(t) { we.push(t) } function kt(t) { Cr.push(t) } function Y(t, e = !1) { return A(t, r => { if ((e ? Mr() : Tr()).some(i => r.matches(i))) return !0 }) } function A(t, e) { if (t) { if (e(t)) return t; if (t._x_teleportBack) return A(t._x_teleportBack, e); if (t.parentNode instanceof ShadowRoot) return A(t.parentNode.host, e); if (t.parentElement) return A(t.parentElement, e) } } function Rr(t) { return Tr().some(e => t.matches(e)) } var Nr = []; function Pr(t) { Nr.push(t) } var Wn = 1; function v(t, e = D, r = () => { }) { A(t, n => n._x_ignore) || br(() => { e(t, (n, i) => { n._x_marker || (r(n, i), Nr.forEach(o => o(n, i)), pt(n, n.attributes).forEach(o => o()), n._x_ignore || (n._x_marker = Wn++), n._x_ignore && i()) }) }) } function k(t, e = D) { e(t, r => { rr(r), ce(r), delete r._x_marker }) } function Gn() { [["ui", "dialog", ["[x-dialog], [x-popover]"]], ["anchor", "anchor", ["[x-anchor]"]], ["sort", "sort", ["[x-sort]"]]].forEach(([e, r, n]) => { xr(r) || n.some(i => { if (document.querySelector(i)) return S(`found "${i}", but missing ${e} plugin`), !0 }) }) } var Ee = [], Se = !1; function st(t = () => { }) { return queueMicrotask(() => { Se || setTimeout(() => { It() }) }), new Promise(e => { Ee.push(() => { t(), e() }) }) } function It() { for (Se = !1; Ee.length;)Ee.shift()() } function Dr() { Se = !0 } function mt(t, e) { return Array.isArray(e) ? kr(t, e.join(" ")) : typeof e == "object" && e !== null ? Jn(t, e) : typeof e == "function" ? mt(t, e()) : kr(t, e) } function ve(t) { return t.split(/\s/).filter(Boolean) } function kr(t, e) { let r = i => ve(i).filter(o => !t.classList.contains(o)).filter(Boolean), n = i => (t.classList.add(...i), () => { t.classList.remove(...i) }); return e = e === !0 ? e = "" : e || "", n(r(e)) } function Jn(t, e) { let r = Object.entries(e).flatMap(([s, a]) => a ? ve(s) : !1).filter(Boolean), n = Object.entries(e).flatMap(([s, a]) => a ? !1 : ve(s)).filter(Boolean), i = [], o = []; return n.forEach(s => { t.classList.contains(s) && (t.classList.remove(s), o.push(s)) }), r.forEach(s => { t.classList.contains(s) || (t.classList.add(s), i.push(s)) }), () => { o.forEach(s => t.classList.add(s)), i.forEach(s => t.classList.remove(s)) } } function X(t, e) { return typeof e == "object" && e !== null ? Yn(t, e) : Xn(t, e) } function Yn(t, e) { let r = {}; return Object.entries(e).forEach(([n, i]) => { r[n] = t.style[n], n.startsWith("--") || (n = Zn(n)), t.style.setProperty(n, i) }), setTimeout(() => { t.style.length === 0 && t.removeAttribute("style") }), () => { X(t, r) } } function Xn(t, e) { let r = t.getAttribute("style", e); return t.setAttribute("style", e), () => { t.setAttribute("style", r || "") } } function Zn(t) { return t.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase() } function ht(t, e = () => { }) { let r = !1; return function () { r ? e.apply(this, arguments) : (r = !0, t.apply(this, arguments)) } } p("transition", (t, { value: e, modifiers: r, expression: n }, { evaluate: i }) => { typeof n == "function" && (n = i(n)), n !== !1 && (!n || typeof n == "boolean" ? ti(t, r, e) : Qn(t, n, e)) }); function Qn(t, e, r) { Ir(t, mt, ""), { enter: i => { t._x_transition.enter.during = i }, "enter-start": i => { t._x_transition.enter.start = i }, "enter-end": i => { t._x_transition.enter.end = i }, leave: i => { t._x_transition.leave.during = i }, "leave-start": i => { t._x_transition.leave.start = i }, "leave-end": i => { t._x_transition.leave.end = i } }[r](e) } function ti(t, e, r) { Ir(t, X); let n = !e.includes("in") && !e.includes("out") && !r, i = n || e.includes("in") || ["enter"].includes(r), o = n || e.includes("out") || ["leave"].includes(r); e.includes("in") && !n && (e = e.filter((w, tt) => tt < e.indexOf("out"))), e.includes("out") && !n && (e = e.filter((w, tt) => tt > e.indexOf("out"))); let s = !e.includes("opacity") && !e.includes("scale"), a = s || e.includes("opacity"), c = s || e.includes("scale"), u = a ? 0 : 1, l = c ? _t(e, "scale", 95) / 100 : 1, f = _t(e, "delay", 0) / 1e3, b = _t(e, "origin", "center"), g = "opacity, transform", L = _t(e, "duration", 150) / 1e3, d = _t(e, "duration", 75) / 1e3, y = "cubic-bezier(0.4, 0.0, 0.2, 1)"; i && (t._x_transition.enter.during = { transformOrigin: b, transitionDelay: `${f}s`, transitionProperty: g, transitionDuration: `${L}s`, transitionTimingFunction: y }, t._x_transition.enter.start = { opacity: u, transform: `scale(${l})` }, t._x_transition.enter.end = { opacity: 1, transform: "scale(1)" }), o && (t._x_transition.leave.during = { transformOrigin: b, transitionDelay: `${f}s`, transitionProperty: g, transitionDuration: `${d}s`, transitionTimingFunction: y }, t._x_transition.leave.start = { opacity: 1, transform: "scale(1)" }, t._x_transition.leave.end = { opacity: u, transform: `scale(${l})` }) } function Ir(t, e, r = {}) { t._x_transition || (t._x_transition = { enter: { during: r, start: r, end: r }, leave: { during: r, start: r, end: r }, in(n = () => { }, i = () => { }) { $t(t, e, { during: this.enter.during, start: this.enter.start, end: this.enter.end }, n, i) }, out(n = () => { }, i = () => { }) { $t(t, e, { during: this.leave.during, start: this.leave.start, end: this.leave.end }, n, i) } }) } window.Element.prototype._x_toggleAndCascadeWithTransitions = function (t, e, r, n) { let i = document.visibilityState === "visible" ? requestAnimationFrame : setTimeout, o = () => i(r); if (e) { t._x_transition && (t._x_transition.enter || t._x_transition.leave) ? t._x_transition.enter && (Object.entries(t._x_transition.enter.during).length || Object.entries(t._x_transition.enter.start).length || Object.entries(t._x_transition.enter.end).length) ? t._x_transition.in(r) : o() : t._x_transition ? t._x_transition.in(r) : o(); return } t._x_hidePromise = t._x_transition ? new Promise((s, a) => { t._x_transition.out(() => { }, () => s(n)), t._x_transitioning && t._x_transitioning.beforeCancel(() => a({ isFromCancelledTransition: !0 })) }) : Promise.resolve(n), queueMicrotask(() => { let s = $r(t); s ? (s._x_hideChildren || (s._x_hideChildren = []), s._x_hideChildren.push(t)) : i(() => { let a = c => { let u = Promise.all([c._x_hidePromise, ...(c._x_hideChildren || []).map(a)]).then(([l]) => l?.()); return delete c._x_hidePromise, delete c._x_hideChildren, u }; a(t).catch(c => { if (!c.isFromCancelledTransition) throw c }) }) }) }; function $r(t) { let e = t.parentNode; if (e) return e._x_hidePromise ? e : $r(e) } function $t(t, e, { during: r, start: n, end: i } = {}, o = () => { }, s = () => { }) { if (t._x_transitioning && t._x_transitioning.cancel(), Object.keys(r).length === 0 && Object.keys(n).length === 0 && Object.keys(i).length === 0) { o(), s(); return } let a, c, u; ei(t, { start() { a = e(t, n) }, during() { c = e(t, r) }, before: o, end() { a(), u = e(t, i) }, after: s, cleanup() { c(), u() } }) } function ei(t, e) { let r, n, i, o = ht(() => { m(() => { r = !0, n || e.before(), i || (e.end(), It()), e.after(), t.isConnected && e.cleanup(), delete t._x_transitioning }) }); t._x_transitioning = { beforeCancels: [], beforeCancel(s) { this.beforeCancels.push(s) }, cancel: ht(function () { for (; this.beforeCancels.length;)this.beforeCancels.shift()(); o() }), finish: o }, m(() => { e.start(), e.during() }), Dr(), requestAnimationFrame(() => { if (r) return; let s = Number(getComputedStyle(t).transitionDuration.replace(/,.*/, "").replace("s", "")) * 1e3, a = Number(getComputedStyle(t).transitionDelay.replace(/,.*/, "").replace("s", "")) * 1e3; s === 0 && (s = Number(getComputedStyle(t).animationDuration.replace("s", "")) * 1e3), m(() => { e.before() }), n = !0, requestAnimationFrame(() => { r || (m(() => { e.end() }), It(), setTimeout(t._x_transitioning.finish, s + a), i = !0) }) }) } function _t(t, e, r) { if (t.indexOf(e) === -1) return r; let n = t[t.indexOf(e) + 1]; if (!n || e === "scale" && isNaN(n)) return r; if (e === "duration" || e === "delay") { let i = n.match(/([0-9]+)ms/); if (i) return i[1] } return e === "origin" && ["top", "right", "left", "center", "bottom"].includes(t[t.indexOf(e) + 2]) ? [n, t[t.indexOf(e) + 2]].join(" ") : n } var I = !1; function E(t, e = () => { }) { return (...r) => I ? e(...r) : t(...r) } function Lr(t) { return (...e) => I && t(...e) } var jr = []; function V(t) { jr.push(t) } function Fr(t, e) { jr.forEach(r => r(t, e)), I = !0, zr(() => { v(e, (r, n) => { n(r, () => { }) }) }), I = !1 } var Lt = !1; function Br(t, e) { e._x_dataStack || (e._x_dataStack = t._x_dataStack), I = !0, Lt = !0, zr(() => { ri(e) }), I = !1, Lt = !1 } function ri(t) { let e = !1; v(t, (n, i) => { D(n, (o, s) => { if (e && Rr(o)) return s(); e = !0, i(o, s) }) }) } function zr(t) { let e = R; ae((r, n) => { let i = e(r); return j(i), () => { } }), t(), ae(e) } function gt(t, e, r, n = []) { switch (t._x_bindings || (t._x_bindings = C({})), t._x_bindings[e] = r, e = n.includes("camel") ? li(e) : e, e) { case "value": ni(t, r); break; case "style": oi(t, r); break; case "class": ii(t, r); break; case "selected": case "checked": si(t, e, r); break; default: Hr(t, e, r); break } } function ni(t, e) { if (jt(t)) t.attributes.value === void 0 && (t.value = e); else if (yt(t)) Number.isInteger(e) ? t.value = e : !Array.isArray(e) && typeof e != "boolean" && ![null, void 0].includes(e) ? t.value = String(e) : Array.isArray(e) ? t.checked = e.some(r => fi(r, t.value)) : t.checked = !!e; else if (t.tagName === "SELECT") ui(t, e); else { if (t.value === e) return; t.value = e === void 0 ? "" : e } } function ii(t, e) { t._x_undoAddedClasses && t._x_undoAddedClasses(), t._x_undoAddedClasses = mt(t, e) } function oi(t, e) { t._x_undoAddedStyles && t._x_undoAddedStyles(), t._x_undoAddedStyles = X(t, e) } function si(t, e, r) { Hr(t, e, r), ci(t, e, r) } function Hr(t, e, r) { [null, void 0, !1].includes(r) && pi(e) ? t.removeAttribute(e) : (Vr(e) && (r = e), ai(t, e, r)) } function ai(t, e, r) { t.getAttribute(e) != r && t.setAttribute(e, r) } function ci(t, e, r) { t[e] !== r && (t[e] = r) } function ui(t, e) { let r = [].concat(e).map(n => n + ""); Array.from(t.options).forEach(n => { n.selected = r.includes(n.value) }) } function li(t) { return t.toLowerCase().replace(/-(\w)/g, (e, r) => r.toUpperCase()) } function fi(t, e) { return t == e } function xt(t) { return [1, "1", "true", "on", "yes", !0].includes(t) ? !0 : [0, "0", "false", "off", "no", !1].includes(t) ? !1 : t ? Boolean(t) : null } var di = new Set(["allowfullscreen", "async", "autofocus", "autoplay", "checked", "controls", "default", "defer", "disabled", "formnovalidate", "inert", "ismap", "itemscope", "loop", "multiple", "muted", "nomodule", "novalidate", "open", "playsinline", "readonly", "required", "reversed", "selected", "shadowrootclonable", "shadowrootdelegatesfocus", "shadowrootserializable"]); function Vr(t) { return di.has(t) } function pi(t) { return !["aria-pressed", "aria-checked", "aria-expanded", "aria-selected"].includes(t) } function Ur(t, e, r) { return t._x_bindings && t._x_bindings[e] !== void 0 ? t._x_bindings[e] : qr(t, e, r) } function Kr(t, e, r, n = !0) { if (t._x_bindings && t._x_bindings[e] !== void 0) return t._x_bindings[e]; if (t._x_inlineBindings && t._x_inlineBindings[e] !== void 0) { let i = t._x_inlineBindings[e]; return i.extract = n, Mt(() => T(t, i.expression)) } return qr(t, e, r) } function qr(t, e, r) { let n = t.getAttribute(e); return n === null ? typeof r == "function" ? r() : r : n === "" ? !0 : Vr(e) ? !![e, "true"].includes(n) : n } function yt(t) { return t.type === "checkbox" || t.localName === "ui-checkbox" || t.localName === "ui-switch" } function jt(t) { return t.type === "radio" || t.localName === "ui-radio" } function Ft(t, e) { let r; return function () { let n = this, i = arguments, o = function () { r = null, t.apply(n, i) }; clearTimeout(r), r = setTimeout(o, e) } } function Bt(t, e) { let r; return function () { let n = this, i = arguments; r || (t.apply(n, i), r = !0, setTimeout(() => r = !1, e)) } } function zt({ get: t, set: e }, { get: r, set: n }) { let i = !0, o, s, a = R(() => { let c = t(), u = r(); if (i) n(Ae(c)), i = !1; else { let l = JSON.stringify(c), f = JSON.stringify(u); l !== o ? n(Ae(c)) : l !== f && e(Ae(u)) } o = JSON.stringify(t()), s = JSON.stringify(r()) }); return () => { j(a) } } function Ae(t) { return typeof t == "object" ? JSON.parse(JSON.stringify(t)) : t } function Wr(t) { (Array.isArray(t) ? t : [t]).forEach(r => r(B)) } var Z = {}, Gr = !1; function Jr(t, e) { if (Gr || (Z = C(Z), Gr = !0), e === void 0) return Z[t]; Z[t] = e, rt(Z[t]), typeof e == "object" && e !== null && e.hasOwnProperty("init") && typeof e.init == "function" && Z[t].init() } function Yr() { return Z } var Xr = {}; function Zr(t, e) { let r = typeof e != "function" ? () => e : e; return t instanceof Element ? Oe(t, r()) : (Xr[t] = r, () => { }) } function Qr(t) { return Object.entries(Xr).forEach(([e, r]) => { Object.defineProperty(t, e, { get() { return (...n) => r(...n) } }) }), t } function Oe(t, e, r) { let n = []; for (; n.length;)n.pop()(); let i = Object.entries(e).map(([s, a]) => ({ name: s, value: a })), o = be(i); return i = i.map(s => o.find(a => a.name === s.name) ? { name: `x-bind:${s.name}`, value: `"${s.value}"` } : s), pt(t, i, r).map(s => { n.push(s.runCleanups), s() }), () => { for (; n.length;)n.pop()() } } var tn = {}; function en(t, e) { tn[t] = e } function rn(t, e) { return Object.entries(tn).forEach(([r, n]) => { Object.defineProperty(t, r, { get() { return (...i) => n.bind(e)(...i) }, enumerable: !1 }) }), t } var mi = { get reactive() { return C }, get release() { return j }, get effect() { return R }, get raw() { return se }, get transaction() { return Xe }, version: "3.15.9", flushAndStopDeferringMutations: ir, dontAutoEvaluateFunctions: Mt, disableEffectScheduling: Ge, startObservingMutations: lt, stopObservingMutations: fe, setReactivityEngine: Je, onAttributeRemoved: Ot, onAttributesAdded: At, closestDataStack: F, skipDuringClone: E, onlyDuringClone: Lr, addRootSelector: Dt, addInitSelector: kt, setErrorHandler: ur, interceptClone: V, addScopeToNode: N, deferMutations: nr, mapAttributes: ot, evaluateLater: _, interceptInit: Pr, initInterceptors: rt, injectMagics: H, setEvaluator: fr, setRawEvaluator: pr, mergeProxies: P, extractProp: Kr, findClosest: A, onElRemoved: et, closestRoot: Y, destroyTree: k, interceptor: Tt, transition: $t, setStyles: X, mutateDom: m, directive: p, entangle: zt, throttle: Bt, debounce: Ft, evaluate: T, evaluateRaw: hr, initTree: v, nextTick: st, prefixed: O, prefix: gr, plugin: Wr, magic: x, store: Jr, start: Or, clone: Br, cloneNode: Fr, bound: Ur, $data: Ct, watch: St, walk: D, data: en, bind: Zr }, B = mi; function Ce(t, e) { let r = Object.create(null), n = t.split(","); for (let i = 0; i < n.length; i++)r[n[i]] = !0; return e ? i => !!r[i.toLowerCase()] : i => !!r[i] } var hi = "itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly"; var Ks = Ce(hi + ",async,autofocus,autoplay,controls,default,defer,disabled,hidden,loop,open,required,reversed,scoped,seamless,checked,muted,multiple,selected"); var nn = Object.freeze({}), qs = Object.freeze([]); var _i = Object.prototype.hasOwnProperty, bt = (t, e) => _i.call(t, e), U = Array.isArray, at = t => on(t) === "[object Map]"; var gi = t => typeof t == "string", Ht = t => typeof t == "symbol", wt = t => t !== null && typeof t == "object"; var xi = Object.prototype.toString, on = t => xi.call(t), Te = t => on(t).slice(8, -1); var Vt = t => gi(t) && t !== "NaN" && t[0] !== "-" && "" + parseInt(t, 10) === t; var Ut = t => { let e = Object.create(null); return r => e[r] || (e[r] = t(r)) }, yi = /-(\w)/g, Ws = Ut(t => t.replace(yi, (e, r) => r ? r.toUpperCase() : "")), bi = /\B([A-Z])/g, Gs = Ut(t => t.replace(bi, "-$1").toLowerCase()), Me = Ut(t => t.charAt(0).toUpperCase() + t.slice(1)), Js = Ut(t => t ? `on${Me(t)}` : ""), Re = (t, e) => t !== e && (t === t || e === e); var Ne = new WeakMap, Et = [], $, Q = Symbol("iterate"), Pe = Symbol("Map key iterate"); function wi(t) { return t && t._isEffect === !0 } function fn(t, e = nn) { wi(t) && (t = t.raw); let r = Si(t, e); return e.lazy || r(), r } function dn(t) { t.active && (pn(t), t.options.onStop && t.options.onStop(), t.active = !1) } var Ei = 0; function Si(t, e) { let r = function () { if (!r.active) return t(); if (!Et.includes(r)) { pn(r); try { return Ai(), Et.push(r), $ = r, t() } finally { Et.pop(), mn(), $ = Et[Et.length - 1] } } }; return r.id = Ei++, r.allowRecurse = !!e.allowRecurse, r._isEffect = !0, r.active = !0, r.raw = t, r.deps = [], r.options = e, r } function pn(t) { let { deps: e } = t; if (e.length) { for (let r = 0; r < e.length; r++)e[r].delete(t); e.length = 0 } } var ct = !0, ke = []; function vi() { ke.push(ct), ct = !1 } function Ai() { ke.push(ct), ct = !0 } function mn() { let t = ke.pop(); ct = t === void 0 ? !0 : t } function M(t, e, r) { if (!ct || $ === void 0) return; let n = Ne.get(t); n || Ne.set(t, n = new Map); let i = n.get(r); i || n.set(r, i = new Set), i.has($) || (i.add($), $.deps.push(i), $.options.onTrack && $.options.onTrack({ effect: $, target: t, type: e, key: r })) } function q(t, e, r, n, i, o) { let s = Ne.get(t); if (!s) return; let a = new Set, c = l => { l && l.forEach(f => { (f !== $ || f.allowRecurse) && a.add(f) }) }; if (e === "clear") s.forEach(c); else if (r === "length" && U(t)) s.forEach((l, f) => { (f === "length" || f >= n) && c(l) }); else switch (r !== void 0 && c(s.get(r)), e) { case "add": U(t) ? Vt(r) && c(s.get("length")) : (c(s.get(Q)), at(t) && c(s.get(Pe))); break; case "delete": U(t) || (c(s.get(Q)), at(t) && c(s.get(Pe))); break; case "set": at(t) && c(s.get(Q)); break }let u = l => { l.options.onTrigger && l.options.onTrigger({ effect: l, target: t, key: r, type: e, newValue: n, oldValue: i, oldTarget: o }), l.options.scheduler ? l.options.scheduler(l) : l() }; a.forEach(u) } var Oi = Ce("__proto__,__v_isRef,__isVue"), hn = new Set(Object.getOwnPropertyNames(Symbol).map(t => Symbol[t]).filter(Ht)), Ci = _n(); var Ti = _n(!0); var sn = Mi(); function Mi() { let t = {}; return ["includes", "indexOf", "lastIndexOf"].forEach(e => { t[e] = function (...r) { let n = h(this); for (let o = 0, s = this.length; o < s; o++)M(n, "get", o + ""); let i = n[e](...r); return i === -1 || i === !1 ? n[e](...r.map(h)) : i } }), ["push", "pop", "shift", "unshift", "splice"].forEach(e => { t[e] = function (...r) { vi(); let n = h(this)[e].apply(this, r); return mn(), n } }), t } function _n(t = !1, e = !1) { return function (n, i, o) { if (i === "__v_isReactive") return !t; if (i === "__v_isReadonly") return t; if (i === "__v_raw" && o === (t ? e ? Ki : bn : e ? Ui : yn).get(n)) return n; let s = U(n); if (!t && s && bt(sn, i)) return Reflect.get(sn, i, o); let a = Reflect.get(n, i, o); return (Ht(i) ? hn.has(i) : Oi(i)) || (t || M(n, "get", i), e) ? a : De(a) ? !s || !Vt(i) ? a.value : a : wt(a) ? t ? wn(a) : Xt(a) : a } } var Ri = Ni(); function Ni(t = !1) { return function (r, n, i, o) { let s = r[n]; if (!t && (i = h(i), s = h(s), !U(r) && De(s) && !De(i))) return s.value = i, !0; let a = U(r) && Vt(n) ? Number(n) < r.length : bt(r, n), c = Reflect.set(r, n, i, o); return r === h(o) && (a ? Re(i, s) && q(r, "set", n, i, s) : q(r, "add", n, i)), c } } function Pi(t, e) { let r = bt(t, e), n = t[e], i = Reflect.deleteProperty(t, e); return i && r && q(t, "delete", e, void 0, n), i } function Di(t, e) { let r = Reflect.has(t, e); return (!Ht(e) || !hn.has(e)) && M(t, "has", e), r } function ki(t) { return M(t, "iterate", U(t) ? "length" : Q), Reflect.ownKeys(t) } var Ii = { get: Ci, set: Ri, deleteProperty: Pi, has: Di, ownKeys: ki }, $i = { get: Ti, set(t, e) { return console.warn(`Set operation on key "${String(e)}" failed: target is readonly.`, t), !0 }, deleteProperty(t, e) { return console.warn(`Delete operation on key "${String(e)}" failed: target is readonly.`, t), !0 } }; var Ie = t => wt(t) ? Xt(t) : t, $e = t => wt(t) ? wn(t) : t, Le = t => t, Yt = t => Reflect.getPrototypeOf(t); function Kt(t, e, r = !1, n = !1) { t = t.__v_raw; let i = h(t), o = h(e); e !== o && !r && M(i, "get", e), !r && M(i, "get", o); let { has: s } = Yt(i), a = n ? Le : r ? $e : Ie; if (s.call(i, e)) return a(t.get(e)); if (s.call(i, o)) return a(t.get(o)); t !== i && t.get(e) } function qt(t, e = !1) { let r = this.__v_raw, n = h(r), i = h(t); return t !== i && !e && M(n, "has", t), !e && M(n, "has", i), t === i ? r.has(t) : r.has(t) || r.has(i) } function Wt(t, e = !1) { return t = t.__v_raw, !e && M(h(t), "iterate", Q), Reflect.get(t, "size", t) } function an(t) { t = h(t); let e = h(this); return Yt(e).has.call(e, t) || (e.add(t), q(e, "add", t, t)), this } function cn(t, e) { e = h(e); let r = h(this), { has: n, get: i } = Yt(r), o = n.call(r, t); o ? xn(r, n, t) : (t = h(t), o = n.call(r, t)); let s = i.call(r, t); return r.set(t, e), o ? Re(e, s) && q(r, "set", t, e, s) : q(r, "add", t, e), this } function un(t) { let e = h(this), { has: r, get: n } = Yt(e), i = r.call(e, t); i ? xn(e, r, t) : (t = h(t), i = r.call(e, t)); let o = n ? n.call(e, t) : void 0, s = e.delete(t); return i && q(e, "delete", t, void 0, o), s } function ln() { let t = h(this), e = t.size !== 0, r = at(t) ? new Map(t) : new Set(t), n = t.clear(); return e && q(t, "clear", void 0, void 0, r), n } function Gt(t, e) { return function (n, i) { let o = this, s = o.__v_raw, a = h(s), c = e ? Le : t ? $e : Ie; return !t && M(a, "iterate", Q), s.forEach((u, l) => n.call(i, c(u), c(l), o)) } } function Jt(t, e, r) { return function (...n) { let i = this.__v_raw, o = h(i), s = at(o), a = t === "entries" || t === Symbol.iterator && s, c = t === "keys" && s, u = i[t](...n), l = r ? Le : e ? $e : Ie; return !e && M(o, "iterate", c ? Pe : Q), { next() { let { value: f, done: b } = u.next(); return b ? { value: f, done: b } : { value: a ? [l(f[0]), l(f[1])] : l(f), done: b } }, [Symbol.iterator]() { return this } } } } function K(t) { return function (...e) { { let r = e[0] ? `on key "${e[0]}" ` : ""; console.warn(`${Me(t)} operation ${r}failed: target is readonly.`, h(this)) } return t === "delete" ? !1 : this } } function Li() { let t = { get(o) { return Kt(this, o) }, get size() { return Wt(this) }, has: qt, add: an, set: cn, delete: un, clear: ln, forEach: Gt(!1, !1) }, e = { get(o) { return Kt(this, o, !1, !0) }, get size() { return Wt(this) }, has: qt, add: an, set: cn, delete: un, clear: ln, forEach: Gt(!1, !0) }, r = { get(o) { return Kt(this, o, !0) }, get size() { return Wt(this, !0) }, has(o) { return qt.call(this, o, !0) }, add: K("add"), set: K("set"), delete: K("delete"), clear: K("clear"), forEach: Gt(!0, !1) }, n = { get(o) { return Kt(this, o, !0, !0) }, get size() { return Wt(this, !0) }, has(o) { return qt.call(this, o, !0) }, add: K("add"), set: K("set"), delete: K("delete"), clear: K("clear"), forEach: Gt(!0, !0) }; return ["keys", "values", "entries", Symbol.iterator].forEach(o => { t[o] = Jt(o, !1, !1), r[o] = Jt(o, !0, !1), e[o] = Jt(o, !1, !0), n[o] = Jt(o, !0, !0) }), [t, r, e, n] } var [ji, Fi, Bi, zi] = Li(); function gn(t, e) { let r = e ? t ? zi : Bi : t ? Fi : ji; return (n, i, o) => i === "__v_isReactive" ? !t : i === "__v_isReadonly" ? t : i === "__v_raw" ? n : Reflect.get(bt(r, i) && i in n ? r : n, i, o) } var Hi = { get: gn(!1, !1) }; var Vi = { get: gn(!0, !1) }; function xn(t, e, r) { let n = h(r); if (n !== r && e.call(t, n)) { let i = Te(t); console.warn(`Reactive ${i} contains both the raw and reactive versions of the same object${i === "Map" ? " as keys" : ""}, which can lead to inconsistencies. Avoid differentiating between the raw and reactive versions of an object and only use the reactive version if possible.`) } } var yn = new WeakMap, Ui = new WeakMap, bn = new WeakMap, Ki = new WeakMap; function qi(t) { switch (t) { case "Object": case "Array": return 1; case "Map": case "Set": case "WeakMap": case "WeakSet": return 2; default: return 0 } } function Wi(t) { return t.__v_skip || !Object.isExtensible(t) ? 0 : qi(Te(t)) } function Xt(t) { return t && t.__v_isReadonly ? t : En(t, !1, Ii, Hi, yn) } function wn(t) { return En(t, !0, $i, Vi, bn) } function En(t, e, r, n, i) { if (!wt(t)) return console.warn(`value cannot be made reactive: ${String(t)}`), t; if (t.__v_raw && !(e && t.__v_isReactive)) return t; let o = i.get(t); if (o) return o; let s = Wi(t); if (s === 0) return t; let a = new Proxy(t, s === 2 ? n : r); return i.set(t, a), a } function h(t) { return t && h(t.__v_raw) || t } function De(t) { return Boolean(t && t.__v_isRef === !0) } x("nextTick", () => st); x("dispatch", t => J.bind(J, t)); x("watch", (t, { evaluateLater: e, cleanup: r }) => (n, i) => { let o = e(n), a = St(() => { let c; return o(u => c = u), c }, i); r(a) }); x("store", Yr); x("data", t => Ct(t)); x("root", t => Y(t)); x("refs", t => (t._x_refs_proxy || (t._x_refs_proxy = P(Gi(t))), t._x_refs_proxy)); function Gi(t) { let e = []; return A(t, r => { r._x_refs && e.push(r._x_refs) }), e } var je = {}; function Fe(t) { return je[t] || (je[t] = 0), ++je[t] } function Sn(t, e) { return A(t, r => { if (r._x_ids && r._x_ids[e]) return !0 }) } function vn(t, e) { t._x_ids || (t._x_ids = {}), t._x_ids[e] || (t._x_ids[e] = Fe(e)) } x("id", (t, { cleanup: e }) => (r, n = null) => { let i = `${r}${n ? `-${n}` : ""}`; return Ji(t, i, e, () => { let o = Sn(t, r), s = o ? o._x_ids[r] : Fe(r); return n ? `${r}-${s}-${n}` : `${r}-${s}` }) }); V((t, e) => { t._x_id && (e._x_id = t._x_id) }); function Ji(t, e, r, n) { if (t._x_id || (t._x_id = {}), t._x_id[e]) return t._x_id[e]; let i = n(); return t._x_id[e] = i, r(() => { delete t._x_id[e] }), i } x("el", t => t); An("Focus", "focus", "focus"); An("Persist", "persist", "persist"); function An(t, e, r) { x(e, n => S(`You can't use [$${e}] without first installing the "${t}" plugin here: https://alpinejs.dev/plugins/${r}`, n)) } p("modelable", (t, { expression: e }, { effect: r, evaluateLater: n, cleanup: i }) => { let o = n(e), s = () => { let l; return o(f => l = f), l }, a = n(`${e} = __placeholder`), c = l => a(() => { }, { scope: { __placeholder: l } }), u = s(); c(u), queueMicrotask(() => { if (!t._x_model) return; t._x_removeModelListeners.default(); let l = t._x_model.get, f = t._x_model.setWithModifiers, b = zt({ get() { return l() }, set(g) { f(g) } }, { get() { return s() }, set(g) { c(g) } }); i(b) }) }); p("teleport", (t, { modifiers: e, expression: r }, { cleanup: n }) => { t.tagName.toLowerCase() !== "template" && S("x-teleport can only be used on a <template> tag", t); let i = On(r), o = t.content.cloneNode(!0).firstElementChild; t._x_teleport = o, o._x_teleportBack = t, t.setAttribute("data-teleport-template", !0), o.setAttribute("data-teleport-target", !0), t._x_forwardEvents && t._x_forwardEvents.forEach(a => { o.addEventListener(a, c => { c.stopPropagation(), t.dispatchEvent(new c.constructor(c.type, c)) }) }), N(o, {}, t); let s = (a, c, u) => { u.includes("prepend") ? c.parentNode.insertBefore(a, c) : u.includes("append") ? c.parentNode.insertBefore(a, c.nextSibling) : c.appendChild(a) }; m(() => { s(o, i, e), E(() => { v(o) })() }), t._x_teleportPutBack = () => { let a = On(r); m(() => { s(t._x_teleport, a, e) }) }, n(() => m(() => { o.remove(), k(o) })) }); var Yi = document.createElement("div"); function On(t) { let e = E(() => document.querySelector(t), () => Yi)(); return e || S(`Cannot find x-teleport element for selector: "${t}"`), e } var Cn = () => { }; Cn.inline = (t, { modifiers: e }, { cleanup: r }) => { e.includes("self") ? t._x_ignoreSelf = !0 : t._x_ignore = !0, r(() => { e.includes("self") ? delete t._x_ignoreSelf : delete t._x_ignore }) }; p("ignore", Cn); p("effect", E((t, { expression: e }, { effect: r }) => { r(_(t, e)) })); function z(t, e, r, n) { let i = t, o = c => n(c), s = {}, a = (c, u) => l => u(c, l); return r.includes("dot") && (e = Xi(e)), r.includes("camel") && (e = Zi(e)), r.includes("capture") && (s.capture = !0), r.includes("window") && (i = window), r.includes("document") && (i = document), r.includes("passive") && (s.passive = r[r.indexOf("passive") + 1] !== "false"), o = Be(r, o), r.includes("prevent") && (o = a(o, (c, u) => { u.preventDefault(), c(u) })), r.includes("stop") && (o = a(o, (c, u) => { u.stopPropagation(), c(u) })), r.includes("once") && (o = a(o, (c, u) => { c(u), i.removeEventListener(e, o, s) })), (r.includes("away") || r.includes("outside")) && (i = document, o = a(o, (c, u) => { t.contains(u.target) || u.target.isConnected !== !1 && (t.offsetWidth < 1 && t.offsetHeight < 1 || t._x_isShown !== !1 && c(u)) })), r.includes("self") && (o = a(o, (c, u) => { u.target === t && c(u) })), e === "submit" && (o = a(o, (c, u) => { u.target._x_pendingModelUpdates && u.target._x_pendingModelUpdates.forEach(l => l()), c(u) })), (to(e) || Mn(e)) && (o = a(o, (c, u) => { eo(u, r) || c(u) })), i.addEventListener(e, o, s), () => { i.removeEventListener(e, o, s) } } function Be(t, e) { if (t.includes("debounce")) { let r = t[t.indexOf("debounce") + 1] || "invalid-wait", n = Zt(r.split("ms")[0]) ? Number(r.split("ms")[0]) : 250; e = Ft(e, n) } if (t.includes("throttle")) { let r = t[t.indexOf("throttle") + 1] || "invalid-wait", n = Zt(r.split("ms")[0]) ? Number(r.split("ms")[0]) : 250; e = Bt(e, n) } return e } function Xi(t) { return t.replace(/-/g, ".") } function Zi(t) { return t.toLowerCase().replace(/-(\w)/g, (e, r) => r.toUpperCase()) } function Zt(t) { return !Array.isArray(t) && !isNaN(t) } function Qi(t) { return [" ", "_"].includes(t) ? t : t.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/[_\s]/, "-").toLowerCase() } function to(t) { return ["keydown", "keyup"].includes(t) } function Mn(t) { return ["contextmenu", "click", "mouse"].some(e => t.includes(e)) } function eo(t, e) { let r = e.filter(o => !["window", "document", "prevent", "stop", "once", "capture", "self", "away", "outside", "passive", "preserve-scroll", "blur", "change", "lazy"].includes(o)); if (r.includes("debounce")) { let o = r.indexOf("debounce"); r.splice(o, Zt((r[o + 1] || "invalid-wait").split("ms")[0]) ? 2 : 1) } if (r.includes("throttle")) { let o = r.indexOf("throttle"); r.splice(o, Zt((r[o + 1] || "invalid-wait").split("ms")[0]) ? 2 : 1) } if (r.length === 0 || r.length === 1 && Tn(t.key).includes(r[0])) return !1; let i = ["ctrl", "shift", "alt", "meta", "cmd", "super"].filter(o => r.includes(o)); return r = r.filter(o => !i.includes(o)), !(i.length > 0 && i.filter(s => ((s === "cmd" || s === "super") && (s = "meta"), t[`${s}Key`])).length === i.length && (Mn(t.type) || Tn(t.key).includes(r[0]))) } function Tn(t) { if (!t) return []; t = Qi(t); let e = { ctrl: "control", slash: "/", space: " ", spacebar: " ", cmd: "meta", esc: "escape", up: "arrow-up", down: "arrow-down", left: "arrow-left", right: "arrow-right", period: ".", comma: ",", equal: "=", minus: "-", underscore: "_" }; return e[t] = t, Object.keys(e).map(r => { if (e[r] === t) return r }).filter(r => r) } p("model", (t, { modifiers: e, expression: r }, { effect: n, cleanup: i }) => { let o = t; e.includes("parent") && (o = A(t, d => d !== t)); let s = _(o, r), a; typeof r == "string" ? a = _(o, `${r} = __placeholder`) : typeof r == "function" && typeof r() == "string" ? a = _(o, `${r()} = __placeholder`) : a = () => { }; let c = () => { let d; return s(y => d = y), Rn(d) ? d.get() : d }, u = d => { let y; s(w => y = w), Rn(y) ? y.set(d) : a(() => { }, { scope: { __placeholder: d } }) }; typeof r == "string" && t.type === "radio" && m(() => { t.hasAttribute("name") || t.setAttribute("name", r) }); let l = e.includes("change") || e.includes("lazy"), f = e.includes("blur"), b = e.includes("enter"), g = l || f || b, L; if (I) L = () => { }; else if (g) { let d = [], y = w => u(Qt(t, e, w, c())); if (l && d.push(z(t, "change", e, y)), f && (d.push(z(t, "blur", e, y)), t.form)) { let w = t.form, tt = () => y({ target: t }); w._x_pendingModelUpdates || (w._x_pendingModelUpdates = []), w._x_pendingModelUpdates.push(tt), i(() => { w._x_pendingModelUpdates && w._x_pendingModelUpdates.splice(w._x_pendingModelUpdates.indexOf(tt), 1) }) } b && d.push(z(t, "keydown", e, w => { w.key === "Enter" && y(w) })), L = () => d.forEach(w => w()) } else { let d = t.tagName.toLowerCase() === "select" || ["checkbox", "radio"].includes(t.type) ? "change" : "input"; L = z(t, d, e, y => { u(Qt(t, e, y, c())) }) } if (e.includes("fill") && ([void 0, null, ""].includes(c()) || yt(t) && Array.isArray(c()) || t.tagName.toLowerCase() === "select" && t.multiple) && u(Qt(t, e, { target: t }, c())), t._x_removeModelListeners || (t._x_removeModelListeners = {}), t._x_removeModelListeners.default = L, i(() => t._x_removeModelListeners.default()), t.form) { let d = z(t.form, "reset", [], y => { st(() => t._x_model && t._x_model.set(Qt(t, e, { target: t }, c()))) }); i(() => d()) } t._x_model = { get() { return c() }, set(d) { u(d) }, setWithModifiers: Be(e, u) }, t._x_forceModelUpdate = d => { d === void 0 && typeof r == "string" && r.match(/\./) && (d = ""), m(() => { yt(t) ? Array.isArray(d) ? t.checked = d.some(y => y == t.value) : t.checked = !!d : jt(t) ? typeof d == "boolean" ? t.checked = xt(t.value) === d : t.checked = t.value == d : gt(t, "value", d) }) }, n(() => { let d = c(); e.includes("unintrusive") && document.activeElement.isSameNode(t) || t._x_forceModelUpdate(d) }) }); function Qt(t, e, r, n) { return m(() => { if (r instanceof CustomEvent && r.detail !== void 0) return r.detail !== null && r.detail !== void 0 ? r.detail : r.target.value; if (yt(t)) if (Array.isArray(n)) { let i = null; return e.includes("number") ? i = ze(r.target.value) : e.includes("boolean") ? i = xt(r.target.value) : i = r.target.value, r.target.checked ? n.includes(i) ? n : n.concat([i]) : n.filter(o => !ro(o, i)) } else return r.target.checked; else { if (t.tagName.toLowerCase() === "select" && t.multiple) return e.includes("number") ? Array.from(r.target.selectedOptions).map(i => { let o = i.value || i.text; return ze(o) }) : e.includes("boolean") ? Array.from(r.target.selectedOptions).map(i => { let o = i.value || i.text; return xt(o) }) : Array.from(r.target.selectedOptions).map(i => i.value || i.text); { let i; return jt(t) ? r.target.checked ? i = r.target.value : i = n : i = r.target.value, e.includes("number") ? ze(i) : e.includes("boolean") ? xt(i) : e.includes("trim") ? i.trim() : i } } }) } function ze(t) { let e = t ? parseFloat(t) : null; return no(e) ? e : t } function ro(t, e) { return t == e } function no(t) { return !Array.isArray(t) && !isNaN(t) } function Rn(t) { return t !== null && typeof t == "object" && typeof t.get == "function" && typeof t.set == "function" } p("cloak", t => queueMicrotask(() => m(() => t.removeAttribute(O("cloak"))))); kt(() => `[${O("init")}]`); p("init", E((t, { expression: e }, { evaluate: r }) => typeof e == "string" ? !!e.trim() && r(e, {}, !1) : r(e, {}, !1))); p("text", (t, { expression: e }, { effect: r, evaluateLater: n }) => { let i = n(e); r(() => { i(o => { m(() => { t.textContent = o }) }) }) }); p("html", (t, { expression: e }, { effect: r, evaluateLater: n }) => { let i = n(e); r(() => { i(o => { m(() => { t.innerHTML = o ?? "", t._x_ignoreSelf = !0, v(t), delete t._x_ignoreSelf }) }) }) }); ot(Nt(":", Pt(O("bind:")))); var Nn = (t, { value: e, modifiers: r, expression: n, original: i }, { effect: o, cleanup: s }) => { if (!e) { let c = {}; Qr(c), _(t, n)(l => { Oe(t, l, i) }, { scope: c }); return } if (e === "key") return io(t, n); if (t._x_inlineBindings && t._x_inlineBindings[e] && t._x_inlineBindings[e].extract) return; let a = _(t, n); o(() => a(c => { c === void 0 && typeof n == "string" && n.match(/\./) && (c = ""), m(() => gt(t, e, c, r)) })), s(() => { t._x_undoAddedClasses && t._x_undoAddedClasses(), t._x_undoAddedStyles && t._x_undoAddedStyles() }) }; Nn.inline = (t, { value: e, modifiers: r, expression: n }) => { e && (t._x_inlineBindings || (t._x_inlineBindings = {}), t._x_inlineBindings[e] = { expression: n, extract: !1 }) }; p("bind", Nn); function io(t, e) { t._x_keyExpression = e } Dt(() => `[${O("data")}]`); p("data", (t, { expression: e }, { cleanup: r }) => { if (oo(t)) return; e = e === "" ? "{}" : e; let n = {}; H(n, t); let i = {}; rn(i, n); let o = T(t, e, { scope: i }); (o === void 0 || o === !0) && (o = {}), H(o, t); let s = C(o); rt(s); let a = N(t, s); s.init && T(t, s.init), r(() => { s.destroy && T(t, s.destroy), a() }) }); V((t, e) => { t._x_dataStack && (e._x_dataStack = t._x_dataStack, e.setAttribute("data-has-alpine-state", !0)) }); function oo(t) { return I ? Lt ? !0 : t.hasAttribute("data-has-alpine-state") : !1 } p("show", (t, { modifiers: e, expression: r }, { effect: n }) => { let i = _(t, r); t._x_doHide || (t._x_doHide = () => { m(() => { t.style.setProperty("display", "none", e.includes("important") ? "important" : void 0) }) }), t._x_doShow || (t._x_doShow = () => { m(() => { t.style.length === 1 && t.style.display === "none" ? t.removeAttribute("style") : t.style.removeProperty("display") }) }); let o = () => { t._x_doHide(), t._x_isShown = !1 }, s = () => { t._x_doShow(), t._x_isShown = !0 }, a = () => setTimeout(s), c = ht(f => f ? s() : o(), f => { typeof t._x_toggleAndCascadeWithTransitions == "function" ? t._x_toggleAndCascadeWithTransitions(t, f, s, o) : f ? a() : o() }), u, l = !0; n(() => i(f => { !l && f === u || (e.includes("immediate") && (f ? a() : o()), c(f), u = f, l = !1) })) }); p("for", (t, { expression: e }, { effect: r, cleanup: n }) => { let i = co(e), o = _(t, i.items), s = _(t, t._x_keyExpression || "index"); t._x_lookup = new Map, r(() => ao(t, i, o, s)), n(() => { t._x_lookup.forEach(a => m(() => { k(a), a.remove() })), delete t._x_lookup }) }); function so(t) { return e => { Object.entries(e).forEach(([r, n]) => { t[r] = n }) } } function ao(t, e, r, n) { r(i => { lo(i) && (i = Array.from({ length: i }, (u, l) => l + 1)), i === void 0 && (i = []), i instanceof Set && (i = Array.from(i)), i instanceof Map && (i = Array.from(i)); let o = t._x_lookup, s = new Map; t._x_lookup = s; let a = fo(i), c = Object.entries(i).map(([u, l]) => { a || (u = parseInt(u)); let f = uo(e, l, u, i), b; return n(g => { typeof g == "object" && S("x-for key cannot be an object, it must be a string or an integer", t), o.has(g) && (s.set(g, o.get(g)), o.delete(g)), b = g }, { scope: { index: u, ...f } }), [b, f] }); m(() => { o.forEach(f => { k(f), f.remove() }); let u = new Set, l = t; c.forEach(([f, b]) => { if (s.has(f)) { let d = s.get(f); d._x_refreshXForScope(b), l.nextElementSibling !== d && (l.nextElementSibling && d.replaceWith(l.nextElementSibling), l.after(d)), l = d, d._x_currentIfEl && (d.nextElementSibling !== d._x_currentIfEl && l.after(d._x_currentIfEl), l = d._x_currentIfEl); return } let g = document.importNode(t.content, !0).firstElementChild, L = C(b); N(g, L, t), g._x_refreshXForScope = so(L), s.set(f, g), u.add(g), l.after(g), l = g }), E(() => u.forEach(f => v(f)))() }) }) } function co(t) { let e = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/, r = /^\s*\(|\)\s*$/g, n = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/, i = t.match(n); if (!i) return; let o = {}; o.items = i[2].trim(); let s = i[1].replace(r, "").trim(), a = s.match(e); return a ? (o.item = s.replace(e, "").trim(), o.index = a[1].trim(), a[2] && (o.collection = a[2].trim())) : o.item = s, o } function uo(t, e, r, n) { let i = {}; return /^\[.*\]$/.test(t.item) && Array.isArray(e) ? t.item.replace("[", "").replace("]", "").split(",").map(s => s.trim()).forEach((s, a) => { i[s] = e[a] }) : /^\{.*\}$/.test(t.item) && !Array.isArray(e) && typeof e == "object" ? t.item.replace("{", "").replace("}", "").split(",").map(s => s.trim()).forEach(s => { i[s] = e[s] }) : i[t.item] = e, t.index && (i[t.index] = r), t.collection && (i[t.collection] = n), i } function lo(t) { return !Array.isArray(t) && !isNaN(t) } function fo(t) { return typeof t == "object" && !Array.isArray(t) } function Pn() { } Pn.inline = E((t, { expression: e }, { cleanup: r }) => { let n = Y(t); n._x_refs || (n._x_refs = {}), n._x_refs[e] = t, r(() => delete n._x_refs[e]) }); p("ref", Pn); p("if", (t, { expression: e }, { effect: r, cleanup: n }) => { t.tagName.toLowerCase() !== "template" && S("x-if can only be used on a <template> tag", t); let i = _(t, e), o = () => { if (t._x_currentIfEl) return t._x_currentIfEl; let a = t.content.cloneNode(!0).firstElementChild; return N(a, {}, t), m(() => { t.after(a), E(() => v(a))() }), t._x_currentIfEl = a, t._x_undoIf = () => { m(() => { k(a), a.remove() }), delete t._x_currentIfEl }, a }, s = () => { t._x_undoIf && (t._x_undoIf(), delete t._x_undoIf) }; r(() => i(a => { a ? o() : s() })), n(() => t._x_undoIf && t._x_undoIf()) }); p("id", (t, { expression: e }, { evaluate: r }) => { r(e).forEach(i => vn(t, i)) }); V((t, e) => { t._x_ids && (e._x_ids = t._x_ids) }); ot(Nt("@", Pt(O("on:")))); p("on", E((t, { value: e, modifiers: r, expression: n }, { cleanup: i }) => { let o = n ? _(t, n) : () => { }; t.tagName.toLowerCase() === "template" && (t._x_forwardEvents || (t._x_forwardEvents = []), t._x_forwardEvents.includes(e) || t._x_forwardEvents.push(e)); let s = z(t, e, r, a => { o(() => { }, { scope: { $event: a }, params: [a] }) }); i(() => s()) })); te("Collapse", "collapse", "collapse"); te("Intersect", "intersect", "intersect"); te("Focus", "trap", "focus"); te("Mask", "mask", "mask"); function te(t, e, r) { p(e, n => S(`You can't use [x-${e}] without first installing the "${t}" plugin here: https://alpinejs.dev/plugins/${r}`, n)) } B.setEvaluator(mr); B.setRawEvaluator(_r); B.setReactivityEngine({ reactive: Xt, effect: fn, release: dn, raw: h }); var He = B; targetWindow.Alpine = He; queueMicrotask(() => { He.start() });
        })();

        //targetWindow.Alpine = Alpine;

    })();

})();

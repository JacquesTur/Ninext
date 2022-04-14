// Rev 1.01 du 31 mars 2022
//Display of the table name in grey next to the field name.
//Display a "no items found" message when completion is not possible.
//Case-insensitive sorting.

// Rev 1.02 du 1 avril 2022
// 1 - the afterLoadModules event is called only once after the code initialization. So, if you leave the closeRecord() function, it will only run once and you can reopen the form afterwards.

// 2 - The auto-completion appears directly when you add a character in the editor (a-z, 0-9 or .). If you want it to appear only on ctrl-space, replace the code 
// var configLoadModules := {
//         completion: true,
//         badges: true,
//         evalJS: true    };
// by
// var configLoadModules := {
//         completion: {shortKey : 'Ctrl-Space'},
//         badges: true,
//         evalJS: true    };
// cf: https://codemirror.net/doc/manual.html#keymaps to find other possible key combinations.

// 3 - when you select a function in the completion list, the cursor is positioned between the brackets so that you can directly enter the function parameters.

// Rev 1.03 du 3 avril 2022
// bug fix : 
// - taking into account of capital letters,
// - suppression of the automatic completion when there is only one answer in the list.
// update : 
// - added Ctrl-Space (or any other key defined in configLoadModules.completion) to display the completion list at any time, 
// - positioning the cursor after the opening parenthesis for global functions.

// Rev 1.04 du 11 avril 2022
// update : 
// - name in color according to type : 
//      . green: local variables,
//      . blue: Ninox functions
//      . red : global function
//      . black : fields
//      . grey : tables
// - dlocal variable detection
// - detection of the type of variable returned by formulas, global functions and variables.
// - display of possible fields on a formula, a global function or a variable that returns a table is followed by a dot.

// Rev 1.05 du 14 avril 2022
// bug fix : 
// - add variable name form loop For : 


var exAutoCompletionVersion = '1.05 beta';

var CCodeMirrorStyle = `
    .CodeMirror-hints {
        position: absolute;
        z-index: 10;
        overflow: hidden;
        list-style: none;

        margin: 0;
        padding: 2px;

        -webkit-box-shadow: 2px 3px 5px rgba(0, 0, 0, .2);
        -moz-box-shadow: 2px 3px 5px rgba(0, 0, 0, .2);
        box-shadow: 2px 3px 5px rgba(0, 0, 0, .2);
        border-radius: 3px;
        border: 1px solid silver;

        background: white;
        font-size: 90%;

        max-height: 20em;
        overflow-y: auto;
    }

    .CodeMirror-hint {
        margin: 0;
        padding: 0 4px;
        border-radius: 2px;
        white-space: pre;
        color: black;
        cursor: pointer;
    }

    .CodeMirror-hint-active {
        background: #08f;
        color: white;
    }

    .CodeMirror-hint-label {
        color: inherit;
    }

    .CodeMirror-hint-grey-label {
        color: LightGray;
        font-style: italic;
        padding-left: 4px;
        padding-right: 4px;
    }`;


//put CCodeMirrorStyle inside the head element.
var style = document.getElementById('exCoredMirrorStyle');
if (!style) {
    style = document.createElement('style');

}
document.head.appendChild(style);

style.innerText = CCodeMirrorStyle;

// documentation online : https://share.ninox.com/xymklkqzebxkx8kcgtakgxhdd0ilk70xw8vo

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

// declare global: DOMRect

window.exCodeMirrorHint = (function () {
    "use strict";

    var HINT_ELEMENT_CLASS = "CodeMirror-hint";
    var ACTIVE_HINT_ELEMENT_CLASS = "CodeMirror-hint-active";

    // This is the old interface, kept around for now to stay
    // backwards-compatible.
    CodeMirror.showHint = function (cm, getHints, options) {
        if (!getHints) return cm.showHint(options);
        if (options && options.async) getHints.async = true;
        var newOpts = { hint: getHints };
        if (options) for (var prop in options) newOpts[prop] = options[prop];
        return cm.showHint(newOpts);
    };

    CodeMirror.defineExtension("showHint", function (options) {
        options = parseOptions(this, this.getCursor("start"), options);
        var selections = this.listSelections()
        if (selections.length > 1) return;
        // By default, don't allow completion when something is selected.
        // A hint function can have a `supportsSelection` property to
        // indicate that it can handle selections.
        if (this.somethingSelected()) {
            if (!options.hint.supportsSelection) return;
            // Don't try with cross-line selections
            for (var i = 0; i < selections.length; i++)
                if (selections[i].head.line != selections[i].anchor.line) return;
        }

        if (this.state.completionActive) this.state.completionActive.close();
        var completion = this.state.completionActive = new Completion(this, options);
        if (!completion.options.hint) return;

        CodeMirror.signal(this, "startCompletion", this);
        completion.update(true);
    });

    CodeMirror.defineExtension("closeHint", function () {
        if (this.state.completionActive) this.state.completionActive.close()
    })

    function Completion(cm, options) {
        this.cm = cm;
        this.options = options;
        this.widget = null;
        this.debounce = 0;
        this.tick = 0;
        this.startPos = this.cm.getCursor("start");
        this.startLen = this.cm.getLine(this.startPos.line).length - this.cm.getSelection().length;

        if (this.options.updateOnCursorActivity) {
            var self = this;
            cm.on("cursorActivity", this.activityFunc = function () { self.cursorActivity(); });
        }
    }

    var requestAnimationFrame = window.requestAnimationFrame || function (fn) {
        return setTimeout(fn, 1000 / 60);
    };
    var cancelAnimationFrame = window.cancelAnimationFrame || clearTimeout;

    Completion.prototype = {
        close: function () {
            if (!this.active()) return;
            this.cm.state.completionActive = null;
            this.tick = null;
            if (this.options.updateOnCursorActivity) {
                this.cm.off("cursorActivity", this.activityFunc);
            }

            if (this.widget && this.data) CodeMirror.signal(this.data, "close");
            if (this.widget) this.widget.close();
            CodeMirror.signal(this.cm, "endCompletion", this.cm);
        },

        active: function () {
            return this.cm.state.completionActive == this;
        },

        pick: function (data, i) {
            var completion = data.list[i], self = this;
            this.cm.operation(function () {
                if (completion.hint)
                    completion.hint(self.cm, data, completion);
                else
                    self.cm.replaceRange(getText(completion), completion.from || data.from,
                        completion.to || data.to, "complete");
                CodeMirror.signal(data, "pick", completion);
                self.cm.scrollIntoView();
            });
            if (this.options.closeOnPick) {
                this.close();
            }
        },

        cursorActivity: function () {
            if (this.debounce) {
                cancelAnimationFrame(this.debounce);
                this.debounce = 0;
            }

            var identStart = this.startPos;
            if (this.data) {
                identStart = this.data.from;
            }

            var pos = this.cm.getCursor(), line = this.cm.getLine(pos.line);
            if (pos.line != this.startPos.line || line.length - pos.ch != this.startLen - this.startPos.ch ||
                pos.ch < identStart.ch || this.cm.somethingSelected() ||
                (!pos.ch || this.options.closeCharacters.test(line.charAt(pos.ch - 1)))) {
                this.close();
            } else {
                var self = this;
                this.debounce = requestAnimationFrame(function () { self.update(); });
                if (this.widget) this.widget.disable();
            }
        },

        update: function (first) {
            if (this.tick == null) return
            var self = this, myTick = ++this.tick
            fetchHints(this.options.hint, this.cm, this.options, function (data) {
                if (self.tick == myTick) self.finishUpdate(data, first)
            })
        },

        finishUpdate: function (data, first) {
            if (this.data) CodeMirror.signal(this.data, "update");

            var picked = (this.widget && this.widget.picked) || (first && this.options.completeSingle);
            if (this.widget) this.widget.close();

            this.data = data;

            if (data && data.list.length) {
                if (picked && data.list.length == 1) {
                    this.pick(data, 0);
                } else {
                    this.widget = new Widget(this, data);
                    CodeMirror.signal(data, "shown");
                }
            }
        }
    };

    function parseOptions(cm, pos, options) {
        var editor = cm.options.hintOptions;
        var out = {};
        for (var prop in defaultOptions) out[prop] = defaultOptions[prop];
        if (editor) for (var prop in editor)
            if (editor[prop] !== undefined) out[prop] = editor[prop];
        if (options) for (var prop in options)
            if (options[prop] !== undefined) out[prop] = options[prop];
        if (out.hint.resolve) out.hint = out.hint.resolve(cm, pos)
        return out;
    }

    function getText(completion) {
        if (typeof completion == "string") return completion;
        else return completion.text;
    }

    function buildKeyMap(completion, handle) {
        var baseMap = {
            Up: function () { handle.moveFocus(-1); },
            Down: function () { handle.moveFocus(1); },
            PageUp: function () { handle.moveFocus(-handle.menuSize() + 1, true); },
            PageDown: function () { handle.moveFocus(handle.menuSize() - 1, true); },
            Home: function () { handle.setFocus(0); },
            End: function () { handle.setFocus(handle.length - 1); },
            Enter: handle.pick,
            Tab: handle.pick,
            Esc: handle.close
        };

        var mac = /Mac/.test(navigator.platform);

        if (mac) {
            baseMap["Ctrl-P"] = function () { handle.moveFocus(-1); };
            baseMap["Ctrl-N"] = function () { handle.moveFocus(1); };
        }

        var custom = completion.options.customKeys;
        var ourMap = custom ? {} : baseMap;
        function addBinding(key, val) {
            var bound;
            if (typeof val != "string")
                bound = function (cm) { return val(cm, handle); };
            // This mechanism is deprecated
            else if (baseMap.hasOwnProperty(val))
                bound = baseMap[val];
            else
                bound = val;
            ourMap[key] = bound;
        }
        if (custom)
            for (var key in custom) if (custom.hasOwnProperty(key))
                addBinding(key, custom[key]);
        var extra = completion.options.extraKeys;
        if (extra)
            for (var key in extra) if (extra.hasOwnProperty(key))
                addBinding(key, extra[key]);
        return ourMap;
    }

    function getHintElement(hintsElement, el) {
        while (el && el != hintsElement) {
            if (el.nodeName.toUpperCase() === "LI" && el.parentNode == hintsElement) return el;
            el = el.parentNode;
        }
    }

    function Widget(completion, data) {
        this.id = "cm-complete-" + Math.floor(Math.random(1e6))
        this.completion = completion;
        this.data = data;
        this.picked = false;
        var widget = this, cm = completion.cm;
        var ownerDocument = cm.getInputField().ownerDocument;
        var parentWindow = ownerDocument.defaultView || ownerDocument.parentWindow;

        var hints = this.hints = ownerDocument.createElement("ul");
        hints.setAttribute("role", "listbox")
        hints.setAttribute("aria-expanded", "true")
        hints.id = this.id
        var theme = completion.cm.options.theme;
        hints.className = "CodeMirror-hints " + theme;
        this.selectedHint = data.selectedHint || 0;

        var completions = data.list;
        for (var i = 0; i < completions.length; ++i) {
            var elt = hints.appendChild(ownerDocument.createElement("li")), cur = completions[i];
            var className = HINT_ELEMENT_CLASS + (i != this.selectedHint ? "" : " " + ACTIVE_HINT_ELEMENT_CLASS);
            if (cur.className != null) className = cur.className + " " + className;
            elt.className = className;
            if (i == this.selectedHint) elt.setAttribute("aria-selected", "true")
            elt.id = this.id + "-" + i
            elt.setAttribute("role", "option")
            if (cur.render) cur.render(elt, data, cur);
            else elt.appendChild(ownerDocument.createTextNode(cur.displayText || getText(cur)));
            elt.hintId = i;
        }

        var container = completion.options.container || ownerDocument.body;
        var pos = cm.cursorCoords(completion.options.alignWithWord ? data.from : null);
        var left = pos.left, top = pos.bottom, below = true;
        var offsetLeft = 0, offsetTop = 0;
        if (container !== ownerDocument.body) {
            // We offset the cursor position because left and top are relative to the offsetParent's top left corner.
            var isContainerPositioned = ['absolute', 'relative', 'fixed'].indexOf(parentWindow.getComputedStyle(container).position) !== -1;
            var offsetParent = isContainerPositioned ? container : container.offsetParent;
            var offsetParentPosition = offsetParent.getBoundingClientRect();
            var bodyPosition = ownerDocument.body.getBoundingClientRect();
            offsetLeft = (offsetParentPosition.left - bodyPosition.left - offsetParent.scrollLeft);
            offsetTop = (offsetParentPosition.top - bodyPosition.top - offsetParent.scrollTop);
        }
        hints.style.left = (left - offsetLeft) + "px";
        hints.style.top = (top - offsetTop) + "px";

        // If we're at the edge of the screen, then we want the menu to appear on the left of the cursor.
        var winW = parentWindow.innerWidth || Math.max(ownerDocument.body.offsetWidth, ownerDocument.documentElement.offsetWidth);
        var winH = parentWindow.innerHeight || Math.max(ownerDocument.body.offsetHeight, ownerDocument.documentElement.offsetHeight);
        container.appendChild(hints);
        cm.getInputField().setAttribute("aria-autocomplete", "list")
        cm.getInputField().setAttribute("aria-owns", this.id)
        cm.getInputField().setAttribute("aria-activedescendant", this.id + "-" + this.selectedHint)

        var box = completion.options.moveOnOverlap ? hints.getBoundingClientRect() : new DOMRect();
        var scrolls = completion.options.paddingForScrollbar ? hints.scrollHeight > hints.clientHeight + 1 : false;

        // Compute in the timeout to avoid reflow on init
        var startScroll;
        setTimeout(function () { startScroll = cm.getScrollInfo(); });

        var overlapY = box.bottom - winH;
        if (overlapY > 0) {
            var height = box.bottom - box.top, curTop = pos.top - (pos.bottom - box.top);
            if (curTop - height > 0) { // Fits above cursor
                hints.style.top = (top = pos.top - height - offsetTop) + "px";
                below = false;
            } else if (height > winH) {
                hints.style.height = (winH - 5) + "px";
                hints.style.top = (top = pos.bottom - box.top - offsetTop) + "px";
                var cursor = cm.getCursor();
                if (data.from.ch != cursor.ch) {
                    pos = cm.cursorCoords(cursor);
                    hints.style.left = (left = pos.left - offsetLeft) + "px";
                    box = hints.getBoundingClientRect();
                }
            }
        }
        var overlapX = box.right - winW;
        if (scrolls) overlapX += cm.display.nativeBarWidth;
        if (overlapX > 0) {
            if (box.right - box.left > winW) {
                hints.style.width = (winW - 5) + "px";
                overlapX -= (box.right - box.left) - winW;
            }
            hints.style.left = (left = pos.left - overlapX - offsetLeft) + "px";
        }
        if (scrolls) for (var node = hints.firstChild; node; node = node.nextSibling)
            node.style.paddingRight = cm.display.nativeBarWidth + "px"

        cm.addKeyMap(this.keyMap = buildKeyMap(completion, {
            moveFocus: function (n, avoidWrap) { widget.changeActive(widget.selectedHint + n, avoidWrap); },
            setFocus: function (n) { widget.changeActive(n); },
            menuSize: function () { return widget.screenAmount(); },
            length: completions.length,
            close: function () { completion.close(); },
            pick: function () { widget.pick(); },
            data: data
        }));

        if (completion.options.closeOnUnfocus) {
            var closingOnBlur;
            cm.on("blur", this.onBlur = function () { closingOnBlur = setTimeout(function () { completion.close(); }, 100); });
            cm.on("focus", this.onFocus = function () { clearTimeout(closingOnBlur); });
        }

        cm.on("scroll", this.onScroll = function () {
            var curScroll = cm.getScrollInfo(), editor = cm.getWrapperElement().getBoundingClientRect();
            if (!startScroll) startScroll = cm.getScrollInfo();
            var newTop = top + startScroll.top - curScroll.top;
            var point = newTop - (parentWindow.pageYOffset || (ownerDocument.documentElement || ownerDocument.body).scrollTop);
            if (!below) point += hints.offsetHeight;
            if (point <= editor.top || point >= editor.bottom) return completion.close();
            hints.style.top = newTop + "px";
            hints.style.left = (left + startScroll.left - curScroll.left) + "px";
        });

        CodeMirror.on(hints, "dblclick", function (e) {
            var t = getHintElement(hints, e.target || e.srcElement);
            if (t && t.hintId != null) { widget.changeActive(t.hintId); widget.pick(); }
        });

        CodeMirror.on(hints, "click", function (e) {
            var t = getHintElement(hints, e.target || e.srcElement);
            if (t && t.hintId != null) {
                widget.changeActive(t.hintId);
                if (completion.options.completeOnSingleClick) widget.pick();
            }
        });

        CodeMirror.on(hints, "mousedown", function () {
            setTimeout(function () { cm.focus(); }, 20);
        });

        // The first hint doesn't need to be scrolled to on init
        var selectedHintRange = this.getSelectedHintRange();
        if (selectedHintRange.from !== 0 || selectedHintRange.to !== 0) {
            this.scrollToActive();
        }

        CodeMirror.signal(data, "select", completions[this.selectedHint], hints.childNodes[this.selectedHint]);
        return true;
    }

    Widget.prototype = {
        close: function () {
            if (this.completion.widget != this) return;
            this.completion.widget = null;
            if (this.hints.parentNode) this.hints.parentNode.removeChild(this.hints);
            this.completion.cm.removeKeyMap(this.keyMap);
            var input = this.completion.cm.getInputField()
            input.removeAttribute("aria-activedescendant")
            input.removeAttribute("aria-owns")

            var cm = this.completion.cm;
            if (this.completion.options.closeOnUnfocus) {
                cm.off("blur", this.onBlur);
                cm.off("focus", this.onFocus);
            }
            cm.off("scroll", this.onScroll);
        },

        disable: function () {
            this.completion.cm.removeKeyMap(this.keyMap);
            var widget = this;
            this.keyMap = { Enter: function () { widget.picked = true; } };
            this.completion.cm.addKeyMap(this.keyMap);
        },

        pick: function () {
            this.completion.pick(this.data, this.selectedHint);
        },

        changeActive: function (i, avoidWrap) {
            if (i >= this.data.list.length)
                i = avoidWrap ? this.data.list.length - 1 : 0;
            else if (i < 0)
                i = avoidWrap ? 0 : this.data.list.length - 1;
            if (this.selectedHint == i) return;
            var node = this.hints.childNodes[this.selectedHint];
            if (node) {
                node.className = node.className.replace(" " + ACTIVE_HINT_ELEMENT_CLASS, "");
                node.removeAttribute("aria-selected")
            }
            node = this.hints.childNodes[this.selectedHint = i];
            node.className += " " + ACTIVE_HINT_ELEMENT_CLASS;
            node.setAttribute("aria-selected", "true")
            this.completion.cm.getInputField().setAttribute("aria-activedescendant", node.id)
            this.scrollToActive()
            CodeMirror.signal(this.data, "select", this.data.list[this.selectedHint], node);
        },

        scrollToActive: function () {
            var selectedHintRange = this.getSelectedHintRange();
            var node1 = this.hints.childNodes[selectedHintRange.from];
            var node2 = this.hints.childNodes[selectedHintRange.to];
            var firstNode = this.hints.firstChild;
            if (node1.offsetTop < this.hints.scrollTop)
                this.hints.scrollTop = node1.offsetTop - firstNode.offsetTop;
            else if (node2.offsetTop + node2.offsetHeight > this.hints.scrollTop + this.hints.clientHeight)
                this.hints.scrollTop = node2.offsetTop + node2.offsetHeight - this.hints.clientHeight + firstNode.offsetTop;
        },

        screenAmount: function () {
            return Math.floor(this.hints.clientHeight / this.hints.firstChild.offsetHeight) || 1;
        },

        getSelectedHintRange: function () {
            var margin = this.completion.options.scrollMargin || 0;
            return {
                from: Math.max(0, this.selectedHint - margin),
                to: Math.min(this.data.list.length - 1, this.selectedHint + margin),
            };
        }
    };

    function applicableHelpers(cm, helpers) {
        if (!cm.somethingSelected()) return helpers
        var result = []
        for (var i = 0; i < helpers.length; i++)
            if (helpers[i].supportsSelection) result.push(helpers[i])
        return result
    }

    function fetchHints(hint, cm, options, callback) {
        if (hint.async) {
            hint(cm, callback, options)
        } else {
            var result = hint(cm, options)
            if (result && result.then) result.then(callback)
            else callback(result)
        }
    }

    function resolveAutoHints(cm, pos) {
        var helpers = cm.getHelpers(pos, "hint"), words
        if (helpers.length) {
            var resolved = function (cm, callback, options) {
                var app = applicableHelpers(cm, helpers);
                function run(i) {
                    if (i == app.length) return callback(null)
                    fetchHints(app[i], cm, options, function (result) {
                        if (result && result.list.length > 0) callback(result)
                        else run(i + 1)
                    })
                }
                run(0)
            }
            resolved.async = true
            resolved.supportsSelection = true
            return resolved
        } else if (words = cm.getHelper(cm.getCursor(), "hintWords")) {
            return function (cm) { return CodeMirror.hint.fromList(cm, { words: words }) }
        } else if (CodeMirror.hint.anyword) {
            return function (cm, options) { return CodeMirror.hint.anyword(cm, options) }
        } else {
            return function () { }
        }
    }

    CodeMirror.registerHelper("hint", "auto", {
        resolve: resolveAutoHints
    });

    CodeMirror.registerHelper("hint", "fromList", function (cm, options) {
        var cur = cm.getCursor(), token = cm.getTokenAt(cur)
        var term, from = CodeMirror.Pos(cur.line, token.start), to = cur
        if (token.start < cur.ch && /\w/.test(token.string.charAt(cur.ch - token.start - 1))) {
            term = token.string.substr(0, cur.ch - token.start)
        } else {
            term = ""
            from = cur
        }
        var found = [];
        for (var i = 0; i < options.words.length; i++) {
            var word = options.words[i];
            if (word.slice(0, term.length) == term)
                found.push(word);
        }

        if (found.length) return { list: found, from: from, to: to };
    });

    CodeMirror.commands.autocomplete = CodeMirror.showHint;

    var defaultOptions = {
        hint: CodeMirror.hint.auto,
        completeSingle: true,
        alignWithWord: true,
        closeCharacters: /[\s()\[\]{};:>,]/,
        closeOnPick: true,
        closeOnUnfocus: true,
        updateOnCursorActivity: true,
        completeOnSingleClick: true,
        container: null,
        customKeys: null,
        extraKeys: null,
        paddingForScrollbar: true,
        moveOnOverlap: true,
    };

    CodeMirror.defineOption("hintOptions", null);
})();

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

window.exAutoCompletion = (function () {
    var Pos = CodeMirror.Pos;

    function getToken(line, start, end, regexp) {
        while (start && regexp.test(line.charAt(start - 1))) --start
        while (end < line.length && regexp.test(line.charAt(end))) ++end
        return { 'keyword': line.slice(start, end), 'start': start, 'end': end }
    }
    function nxHint(editor, options) {


        var cursor = editor.getCursor(), line = editor.getLine(cursor.line)
        var start = cursor.ch, end = cursor.ch
        var token = getToken(line, start, end, /\w/);

        var type = null;
        if (line.charAt(token.start - 1)) {
            if (line.charAt(token.start - 2) == `'`)
                var type = getToken(line, token.start - 3, token.start - 2, /[^']/).keyword;
            else {
                var s = token.start - 2;
                if (line.charAt(token.start - 2) == `)`) {
                    var p = 1;

                    var comment = false;
                    while (p > 0 && s > 1) {
                        s -= 1;
                        switch (line.charAt(s)) {
                            case ')': p++; break;
                            case '"': comment = !comment; break;
                            case '(': p--; break;
                        }
                    }
                    s--;
                }
                if (s >= 0) {
                    if (/^[a-zA-Z]/.test(line.charAt(s))) {
                        var type = getToken(line, s, s, /\w/).keyword;
                    }
                }
            }
        }

        return {
            list: getCompletions(type, token.keyword, /*editor.getRange({ line: 0, ch: 0 }, editor.getCursor())*/ editor.getValue(" "), options),
            from: Pos(cursor.line, token.start),
            to: Pos(cursor.line, token.end)
        };
    };
    CodeMirror.registerHelper(`hint`, `nx`, nxHint);

    var nxFunctions = [{ 'function': 'dialog()' }, { 'function': 'abs()' }, { 'function': 'number()' }, { 'function': 'asin()' }, { 'function': 'atan()' }, { 'function': 'atan2()' }, { 'function': 'ceil()' }, { 'function': 'round()' }, { 'function': 'floor()' }, { 'function': 'sqrt()' }, { 'function': 'sqr()' }, { 'function': 'sign()' }, { 'function': 'sin()' }, { 'function': 'cos()' }, { 'function': 'tan()' }, { 'function': 'random()' }, { 'function': 'pow()' }, { 'function': 'exp()' }, { 'function': 'log()' }, { 'function': 'odd()' }, { 'function': 'even()' }, { 'function': 'ln()' }, { 'function': 'acos()' }, { 'function': 'text()' }, { 'function': 'substr()' }, { 'function': 'length()' }, { 'function': 'trim()' }, { 'function': 'lower()' }, { 'function': 'upper()' }, { 'function': 'lpad()' }, { 'function': 'rpad()' }, { 'function': 'contains()' }, { 'function': 'index()' }, { 'function': 'replace()' }, { 'function': 'capitalize()' }, { 'function': 'chosen()' }, { 'function': 'createTextFile()' }, { 'function': 'now()' }, { 'function': 'today()' }, { 'function': 'date()' }, { 'function': 'day()' }, { 'function': 'weekday()' }, { 'function': 'weekdayName()' }, { 'function': 'weekdayIndex()' }, { 'function': 'week()' }, { 'function': 'yearweek()' }, { 'function': 'month()' }, { 'function': 'year()' }, { 'function': 'yearquarter()' }, { 'function': 'yearmonth()' }, { 'function': 'age()' }, { 'function': 'format()' }, { 'function': 'days()' }, { 'function': 'workdays()' }, { 'function': 'start()' }, { 'function': 'endof()' }, { 'function': 'duration()' }, { 'function': 'time()' }, { 'function': 'datetime()' }, { 'function': 'timeinterval()' }, { 'function': 'appointment()' }, { 'function': 'createCalendarEvent()' }, { 'function': 'createCalendarReminder()' }, { 'function': 'sort()' }, { 'function': 'rsort()' }, { 'function': 'item(ARRAY)' }, { 'function': 'slice()' }, { 'function': 'sum()' }, { 'function': 'avg()' }, { 'function': 'first()' }, { 'function': 'last()' }, { 'function': 'min()' }, { 'function': 'max()' }, { 'function': 'cnt()' }, { 'function': 'concat()' }, { 'function': 'unique()' }, { 'function': 'range()' }, { 'function': 'split()' }, { 'function': 'splitx()' }, { 'function': 'select' }, { 'function': 'create' }, { 'function': 'delete' }, { 'function': 'duplicate()' }, { 'function': 'record()' }, { 'function': 'printRecord()' }, { 'function': 'openPrintLayout()' }, { 'function': 'openRecord()' }, { 'function': 'popupRecord()' }, { 'function': 'openFullscreen()' }, { 'function': 'closeFullscreen()' }, { 'function': 'openTable()' }, { 'function': 'closeRecord()' }, { 'function': 'closeAllRecords()' }, { 'function': 'file()' }, { 'function': 'files()' }, { 'function': 'importFile()' }, { 'function': 'printAndSaveRecord()' }, { 'function': 'if ... then' }, { 'function': 'switch ... case' }, { 'function': 'for ... from ... to' }, { 'function': 'while ... do' }, { 'function': 'icon()' }, { 'function': 'alert()' }, { 'function': 'sendEmail()' }, { 'function': 'barcodeScan()' }, { 'function': 'html()' }, { 'function': 'http()' }, { 'function': 'ninoxApp()' }, { 'function': 'openURL()' }, { 'function': 'urlEncode()' }, { 'function': 'urlDecode()' }, { 'function': 'raw()' }, { 'function': 'parseXML()' }, { 'function': 'formatXML()' }, { 'function': 'location()' }, { 'function': 'longitude()' }, { 'function': 'latitude()' }, { 'function': 'do as server' }, { 'function': 'user()' }, { 'function': 'users()' }, { 'function': 'userId()' }, { 'function': 'userName()' }, { 'function': 'userFirstName()' }, { 'function': 'userLastName()' }, { 'function': 'userFullName()' }, { 'function': 'userEmail()' }, { 'function': 'userHasRole()' }, { 'function': 'userRole()' }, { 'function': 'let' }, { 'function': 'var' }, { 'function': 'replacex()' }, { 'function': 'testx()' }, { 'function': 'extractx()' }, { 'function': 'styled()' }, { 'function': '_cd' }, { 'function': '_md' }, { 'function': 'printTable()' }, { 'function': 'function' }, { 'function': '_cu' }, { 'function': '_mu' }, { 'function': 'numbers()' }, { 'function': 'rgb()' }, { 'function': 'rgba()' }, { 'function': 'quarter()' }, { 'function': 'for ... in ... do' }, { 'function': 'monthName()' }, { 'function': 'monthIndex()' }, { 'function': 'order by' }, { 'function': 'color()' }, { 'function': 'null' }, { 'function': 'userRoles()' }, { 'function': 'item(JSON)' }, { 'function': 'join()' }, { 'function': '---String---' }, { 'function': 'databaseId()' }, { 'function': 'tableId()' }, { 'function': 'teamId()' }, { 'function': 'array()' }, { 'function': 'isAdminMode()' }, { 'function': 'isDatabaseLocked()' }, { 'function': 'isDatabaseProtected()' }, { 'function': 'phone()' }, { 'function': 'email()' }, { 'function': 'url()' }, { 'function': 'sleep()' }, { 'function': 'eval()' }, { 'function': 'clientLang()' }, { 'function': 'like' }, { 'function': 'debug()' }, { 'function': 'degrees()' }, { 'function': 'radians()' }, { 'function': 'userIsAdmin()' }, { 'function': 'debugValueInfo()' }, { 'function': 'timestamp()' }, { 'function': 'string()' }, { 'function': 'substring()' }, { 'function': '%' }, { 'function': 'urlOf()' }, { 'function': 'cached()' }, { 'function': 'invalidate()' }, { 'function': 'weekdayNameAllLang()' }, { 'function': 'parseJSON()' }, { 'function': 'formatJSON()' }, { 'function': 'fileMetadata()' }, { 'function': 'waitForSync()' }, { 'function': 'sendCommand(string,string)' }, { 'function': 'querryConnection(string,string)' }, { 'function': 'getVault(string)' }, { 'function': 'shareFile()' }, { 'function': 'shareView()' }, { 'function': 'unshareFile()' }, { 'function': 'unshareAllViews()' }, { 'function': 'unshareView()' }, { 'function': 'correctedDate()' }, { 'function': 'typeof()' }, { 'function': 'get()' }, { 'function': 'do as transaction' }, { 'function': 'createTempFile()' }, { 'function': 'appendTempFile()' }];

    function getHumanName(caption) {
        if (/[^a-zA-Z]/.test(caption)) return `'${caption}'`;
        else return caption;
    }

    function getCompletions(currentType, keywords, codeToCursor, options) {

        function getElement(text, typeValue, displayText, base, iconClassName, colorName, typeId = null) {
            return {
                displayText: displayText ? displayText : '',
                text: text,
                typeVal: typeValue,
                classeName: 'fn-tools-field',
                base: base,
                colorName: colorName ? colorName : 'light-grey',
                iconClassName: iconClassName,
                type: typeId,
                render: function (elt, data, cur) {
                    elt.classList.add('fn-tools-field');
                    var icon = document.createElement('div');
                    icon.className = 'fn-tools-field-icon i-' + this.colorName + ' ' + (this.iconClassName ? this.iconClassName : '');
                    elt.appendChild(icon);

                    var label = document.createElement('div');
                    label.className = 'fn-tools-field-label CodeMirror-hint-label'
                    label.innerText = cur.text;
                    switch (cur.typeVal) {
                        case 'nxFunction': label.style.color = 'blue'; break;
                        case 'globalFunction': label.style.color = 'red'; break;
                        case 'type': label.style.color = 'gray'; break;
                        case 'var': label.style.color = 'green'; break;
                        default: label.style.color = 'black'; break;
                    }
                    elt.appendChild(label);

                    if (cur.displayText) {
                        var displayLabel = document.createElement('span');
                        displayLabel.className = 'CodeMirror-hint-grey-label'
                        displayLabel.innerText = cur.displayText;
                        label.appendChild(displayLabel);
                    }

                },
                hint(cm, data, completion) {
                    if (completion.text) {
                        cm.replaceRange(completion.text, completion.from || data.from,
                            completion.to || data.to, 'complete');
                        if (['nxFunction', 'globalFunction'].includes(completion.typeVal)) {
                            var pos = completion.text.search(/\(/) + 1 - completion.text.length;
                            cm.moveH(pos, 'char');
                        }
                    }
                }
            }
        }
        var found = [];
        var variables = [];
        options.completeSingle = false;
        //<div class="i-32-12 i-red i-warning"></div>

        function findVariables(exp) {

            if (exp.scopeVariable) {
                var type = exp.scopeVariable.returnType.type ? exp.scopeVariable.returnType.type : null;
                variables.push({ name: exp.scopeVariable.caption, base: exp.scopeVariable.returnType.base, type: type });
            }
            if (exp.exprA) findVariables(exp.exprA)
            if (exp.exprB) findVariables(exp.exprB)
            if (exp.exprs) exp.exprs.forEach(e => {
                findVariables(e)
            })
            if (exp.exps) exp.exps.forEach(e => {
                findVariables(e)
            })

        }


        var codeExp = queries.parseHuman(database.schema, database.schema.types[ui.currentView.tid], codeToCursor, null);
        debugger;
        findVariables(codeExp);

        if (!currentType) {
            variables.forEach(v => {
                if (v.name.search(RegExp(keywords, 'i')) >= 0) {

                    // var iconClassName = 'i-32-24 i-field-' + v.base;
                    // if (v.type)
                    //     iconClassName = 'nav-item-icon ' + (v.type.icon ? 'ic ic-' + v.type.icon : 'i-32-24 ic i-setting-table')
                    found.push(getElement(v.name, 'var', v.type ? 'var -> ' + v.type.caption : 'var', v.base, exUtilsNx.getIconClassName(v), 'grey', v.type ? v.type.id : null));
                }
            })

            nxFunctions.forEach(fn => {
                if (fn.function.search(RegExp(keywords, 'i')) >= 0) {
                    found.push(getElement(fn.function, 'nxFunction', null, 'apply', 'i-32-24 i-field-formula', 'blue'))
                }
            })

            Object.keys(database.schema.globalScope).forEach(f => {
                var func = database.schema.globalScope[f];

                if (func.id.search(RegExp(keywords, 'i')) >= 0) {
                    strFunc = `${getHumanName(func.id)}(${func.params.map(p => { return getHumanName(p.caption) }).join(',')})`
                    var returnType = func.exprA ? func.exprA.returnType : func.returnType;
                    // var iconClassName = 'i-32-24 i-field-' + returnType.base;
                    // if (returnType.type)
                    //     iconClassName = 'nav-item-icon ' + (returnType.type.icon ? 'ic ic-' + returnType.type.icon : 'i-32-24 ic i-setting-table')


                    found.push(getElement(strFunc, 'globalFunction', returnType.type ? 'Fx -> ' + returnType.type.caption : returnType.base, 'fn', exUtilsNx.getIconClassName(returnType), 'red', returnType.type ? returnType.type : null));
                }
            });

        }
        if (currentType) {

            // Search if the currentType is a field that points to a table

            var type = database.schema.findType(currentType);
            if (!type) {
                for (var t in database.schema.types) {
                    var field = database.schema.types[t].findElement(currentType);
                    if (field && field.base) {
                        if (field.base == 'ref' || field.base == 'rev')
                            type = field.refType;
                        // if (field.base == 'dchoice' || field.base == 'dmulti')
                        //     type = field.dchoiceValuesExp.type;
                        if (field.base == 'fn' && field.exp && ['rid', 'nid'].includes(field.exp.returnType.base))
                            type = field.exp.returnType.type;
                    }
                }
                if (!type) variables.forEach(v => {
                    if (v.name == currentType && v.type)
                        type = v.type;
                })

                if (!type)
                    Object.keys(database.schema.globalScope).forEach(f => {
                        var func = database.schema.globalScope[f];
                        if (func.id == currentType && func.exprA && func.exprA.returnType.type)
                            type = func.exprA.returnType.type;
                    })


            }

            if (type) {
                Object.keys(type.fields).forEach(f => {
                    var field = type.fields[f];
                    if (field.caption.search(RegExp(keywords, 'i')) >= 0)
                        found.push(getElement(getHumanName(field.caption), 'field', null, field.base, 'i-32-24 i-field-' + field.base, 'grey'))
                });
            }

        }
        else {
            Object.keys(database.schema.types).forEach(t => {
                var type = database.schema.types[t];
                if (type.caption.search(RegExp(keywords, 'i')) >= 0)
                    found.push(getElement(getHumanName(type.caption), 'type', null, null, 'nav-item-icon ' + (type.icon ? ('ic ic-' + type.icon) : 'i-32-24 i-field-view'), 'grey', type.id))

                Object.keys(type.fields).forEach(f => {
                    var field = type.fields[f];
                    if (field.caption.search(RegExp(keywords, 'i')) >= 0)
                        found.push(getElement(getHumanName(field.caption), 'field', `${getHumanName(type.caption)}`, field.base, 'i-32-24 i-field-' + field.base))
                });

            });
        }




        found.sort((a, b) => {
            var ra = a.text.search(RegExp(keywords, 'i'));
            var rb = b.text.search(RegExp(keywords, 'i'));
            var r = 0;
            if (ra == 0 && rb == 0)

                r = (a.text < b.text);

            else
                if (ra < rb)
                    r = -1;
                else
                    if (ra > rb)
                        r = 1;
                    else r = 0;
            if (r == 0)
                if (a.text > b.text)
                    r = 1;
                else
                    if (a.text < b.text)
                        r = -1;
                    else
                        r = 0;
            return r;
        })
        if (!found.length) found.push(getElement('', '', `no items found    `, null, ''))

        return found;
    }
    return {
        version: exAutoCompletionVersion
    }
})();


var shortKey = (exConfigModules && exConfigModules.completion && exConfigModules.completion.shortKey) ? exConfigModules.completion.shortKey : 'Ctrl-Space';
if (shortKey) {
    if (!CodeMirror.defaults.extraKeys) CodeMirror.defaults.extraKeys = [];
    CodeMirror.defaults.extraKeys[shortKey] = 'autocomplete';
}



if (!CodeMirror.oldFromTextArea) {
    CodeMirror.oldFromTextArea = CodeMirror.fromTextArea;
    CodeMirror.fromTextArea = (textarea, options) => {
        var cm = CodeMirror.oldFromTextArea(textarea, options);


        cm.on("changes", (cm, changeObj) => {
            if (changeObj[0].origin == '+input' && changeObj[0].text[0].length && /[A-Za-z0-9\.]$/.test(changeObj[0].text[0]) && !cm.state.completionActive)
                cm.showHint(null)

        })
        return cm;
    }
}



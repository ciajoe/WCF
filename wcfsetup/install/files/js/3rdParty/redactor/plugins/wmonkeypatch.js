if (!RedactorPlugins) var RedactorPlugins = {};

/**
 * This plugin makes liberally use of dumb monkey patching to adjust Redactor for our needs. In
 * general this is a collection of methods whose side-effects cannot be prevented in any other
 * way or a work-around would cause a giant pile of boilerplates.
 * 
 * ATTENTION!
 * This plugin partially contains code taken from Redactor, Copyright (c) 2009-2015 Imperavi LLC.
 * Under no circumstances you are allowed to use potions or entire code blocks for use anywhere
 * except when directly working with WoltLab Community Framework.
 * 
 * @author	Alexander Ebert
 * @copyright	2001-2015 WoltLab GmbH, 2009-2015 Imperavi LLC.
 * @license	http://imperavi.com/redactor/license/
 */
RedactorPlugins.wmonkeypatch = function() {
	"use strict";
	
	return {
		/**
		 * Initializes the RedactorPlugins.wmonkeypatch plugin.
		 */
		init: function() {
			// module overrides
			this.wmonkeypatch.alignment();
			this.wmonkeypatch.button();
			this.wmonkeypatch.caret();
			this.wmonkeypatch.clean();
			this.wmonkeypatch.code();
			this.wmonkeypatch.dropdown();
			this.wmonkeypatch.image();
			this.wmonkeypatch.indent();
			this.wmonkeypatch.inline();
			this.wmonkeypatch.insert();
			this.wmonkeypatch.keydown();
			this.wmonkeypatch.keyup();
			this.wmonkeypatch.link();
			this.wmonkeypatch.modal();
			this.wmonkeypatch.paste();
			this.wmonkeypatch.observe();
			this.wmonkeypatch.selection();
			this.wmonkeypatch.utils();
			
			// templates
			this.wmonkeypatch.rebuildTemplates();
			
			// events and callbacks
			this.wmonkeypatch.bindEvents();
			
			// browser-specific fixes
			this.wmonkeypatch.fixWebKit();
		},
		
		/**
		 * Setups event listeners and callbacks.
		 */
		bindEvents: function() {
			var $identifier = this.$textarea.wcfIdentify();
			
			// keydown
			this.wutil.setOption('keydownCallback', function(event) {
				var $data = {
					cancel: false,
					event: event
				};
				
				WCF.System.Event.fireEvent('com.woltlab.wcf.redactor', 'keydown_' + $identifier, $data);
				
				return ($data.cancel ? false : true);
			});
			
			// keyup
			this.wutil.setOption('keyupCallback', (function(event) {
				this.wutil.saveSelection();
				
				var $data = {
					cancel: false,
					event: event
				};
				
				WCF.System.Event.fireEvent('com.woltlab.wcf.redactor', 'keyup_' + $identifier, $data);
				
				return ($data.cancel ? false : true);
			}).bind(this));
			
			// buttons response
			if (this.opts.activeButtons) {
				this.$editor.off('mouseup.redactor keyup.redactor focus.redactor');
				
				this.$editor.on('mouseup.redactor keyup.redactor focus.redactor', $.proxy(this.observe.buttons, this));
				this.$editor.on('keyup.redactor', $.proxy(this.keyup.init, this));
			}
			
			var $saveSelection = false;
			this.$editor.on('mousedown.wmonkeypatch', (function() {
				$saveSelection = true;
			}).bind(this));
			
			$(document).on('mouseup.wmonkeypatch', (function() {
				if ($saveSelection) {
					$saveSelection = false;
					
					this.wutil.saveSelection();
				}
			}).bind(this));
			
			var isTargetElement = function(element) {
				// [quote]
				if (element.nodeName === 'BLOCKQUOTE') {
					return true;
				}
				
				// [code]
				if (element.nodeName === 'DIV' && element.classList.contains('codeBox')) {
					return true;
				}
				
				return false;
			};
			
			var getOffset = function(element) {
				var offsets = element.getBoundingClientRect();
				
				return {
					left: offsets.left + document.body.scrollLeft,
					top: offsets.top + document.body.scrollTop
				};
			};
			
			function getVerticalBoundaries(element) {
				var offset = getOffset(element);
				var styles = window.getComputedStyle(element);
				
				return {
					bottom: offset.top + element.offsetHeight + parseInt(styles.marginBottom),
					top: offset.top - parseInt(styles.marginTop)
				};
			};
			
			var setCaretBeforeOrAfter = (function(element, setBefore) {
				var ref;
				if (setBefore) {
					ref = element.previousSibling;
					if (ref === null) {
						var space = this.utils.createSpaceElement();
						element.parentNode.insertBefore(space, element);
						
						this.caret.setEnd(space);
					}
					else {
						this.caret[(ref.nodeType === Node.ELEMENT_NODE && ref.nodeName === 'BR') ? 'setBefore' : 'setAfter'](ref);
					}
				}
				else {
					ref = element.nextSibling;
					if (ref === null || ref === element.nextElementSibling && ref.nodeName === 'BR') {
						var space = this.utils.createSpaceElement();
						if (element.nextSibling === null) element.parentNode.appendChild(space);
						else element.parentNode.insertBefore(space, element.nextSibling);
						
						this.caret.setAfter(space);
					}
					else {
						this.caret.setBefore(ref);
					}
				}
			}).bind(this);
			
			var editor = this.$editor[0];
			this.$editor.on('click.wmonkeypatch', (function(event) {
				var range = (window.getSelection().rangeCount) ? window.getSelection().getRangeAt(0) : null;
				
				if (event.target === editor) {
					var boundaries, element;
					for (var i = 0, length = editor.childElementCount; i < length; i++) {
						element = editor.children[i];
						
						if (!isTargetElement(element)) {
							continue;
						}
						
						boundaries = getVerticalBoundaries(element);
						
						if (event.pageY > boundaries.bottom) {
							continue;
						}
						else if (event.pageY < boundaries.top) {
							break;
						}
						
						if (event.pageY >= boundaries.top && event.pageY <= boundaries.bottom) {
							var diffToTop = event.pageY - boundaries.top;
							var height = boundaries.bottom - boundaries.top;
							var setBefore = (diffToTop <= (height / 2));
							
							var ref = element[setBefore ? 'previousSibling' : 'nextSibling'];
							while (ref !== null) {
								if (ref.nodeType === Node.TEXT_NODE && ref.textContent !== '') {
									// non-empty text node, default behavior is okay
									return;
								}
								else if (ref.nodeType === Node.ELEMENT_NODE && !isTargetElement(ref)) {
									// a non-blocking element such as a formatted line or something, default behavior is okay
									return;
								}
								
								ref = ref[setBefore ? 'previousSibling' : 'nextSibling'];
							}
							
							setCaretBeforeOrAfter(element, setBefore);
						}
					}
					
					// check if caret is now inside <kbd>
					range = (window.getSelection().rangeCount) ? window.getSelection().getRangeAt(0) : null;
					if (range !== null) {
						var container = range.startContainer;
						if (container.nodeType === Node.TEXT_NODE) container = container.parentNode;
						
						if (container.nodeName === 'KBD') {
							if (container.nextElementSibling === editor.lastElementChild) {
								if (editor.lastElementChild.nodeName === 'SPAN' && editor.lastElementChild.textContent === '') {
									editor.removeChild(editor.lastElementChild);
								}
							}
							else if (container.nextSibling === container.nextElementSibling) {
								if (container.nextElementSibling.nodeName === 'KBD' || container.nextElementSibling.nodeName === 'BR') {
									setCaretBeforeOrAfter(container, false);
								}
							}
							
							if (container === editor.lastElementChild) {
								setCaretBeforeOrAfter(container, false);
							}
						}
					}
					
					return false;
				}
				else if (event.target.nodeName === 'LI') {
					// work-around for #1942
					var caretInsideList = false;
					if (range !== null && range.collapsed) {
						var current = range.startContainer;
						while (current !== null && current !== editor) {
							if (current.nodeName === 'LI') {
								caretInsideList = true;
								break;
							}
							
							current = current.parentNode;
						}
					}
					
					if (!caretInsideList || range === null) {
						var node = document.createTextNode('\u200b');
						var firstChild = event.target.children[0];
						firstChild.appendChild(node);
						
						this.caret.setEnd(firstChild);
					}
				}
				else if (event.target.nodeName === 'BLOCKQUOTE') {
					if (range !== null && range.collapsed) {
						// check if caret is now inside a quote
						var blockquote = null;
						var current = range.startContainer;
						while (current !== null && current !== editor) {
							if (current.nodeName === 'BLOCKQUOTE') {
								blockquote = current;
								break;
							}
							
							current = current.parentNode;
						}
						
						if (blockquote !== null && blockquote !== event.target) {
							// click occured within inner quote margin, check if click happened before inner quote
							if (event.pageY <= getOffset(blockquote).top) {
								setCaretBeforeOrAfter(blockquote, true);
							}
							else {
								setCaretBeforeOrAfter(blockquote, false);
							}
						}
					}
				}
			}).bind(this));
		},
		
		/**
		 * Partially overwrites the 'alignment' module.
		 * 
		 *  - Firing an event after setBlocks() has been called, useful to strip unwanted formatting
		 */
		alignment: function() {
			// alignment.setBlocks
			var $mpSetBlocks = this.alignment.setBlocks;
			this.alignment.setBlocks = (function(type) {
				$mpSetBlocks.call(this, type);
				
				WCF.System.Event.fireEvent('com.woltlab.wcf.redactor', 'fixFormatting_' + this.$textarea.wcfIdentify());
			}).bind(this);
		},
		
		/**
		 * Partially overwrites the 'button' module.
		 * 
		 *  - consistent display of dropdowns
		 */
		button: function() {
			// button.addDropdown
			var $mpAddDropdown = this.button.addDropdown;
			this.button.addDropdown = (function($btn, dropdown) {
				var $dropdown = $mpAddDropdown.call(this, $btn, dropdown);
				
				if (!dropdown) {
					$dropdown.addClass('dropdownMenu');
				}
				
				return $dropdown;
			}).bind(this);
		},
		
		/**
		 * Partially overwrites the 'caret' module.
		 * 
		 *  - resolves a selection issue if start === end when setting the caret offsets
		 */
		caret: function() {
			// this.caret.set
			this.caret.set = (function(orgn, orgo, focn, foco) {
				// focus
				// WoltLab fix below [#1970]
				//if (!this.utils.browser('msie')) this.$editor.focus();
				if (!this.utils.browser('msie')) {
					if (this.utils.isMobile() && this.utils.browser('webkit') && navigator.userAgent.match(/(iPad|iPhone|iPod)/i)) {
						if (document.activeElement !== this.$editor[0]) {
							this.$editor.focus();
						}
					}
					else {
						this.$editor.focus();
					}
				}
				
				orgn = orgn[0] || orgn;
				focn = focn[0] || focn;
				
				if (this.utils.isBlockTag(orgn.tagName) && orgn.innerHTML === '')
				{
					orgn.innerHTML = this.opts.invisibleSpace;
				}
				
				if (orgn.tagName == 'BR' && this.opts.linebreaks === false)
				{
					var parent = $(this.opts.emptyHtml)[0];
					$(orgn).replaceWith(parent);
					orgn = parent;
					focn = orgn;
				}
				
				this.selection.get();
				
				try {
					this.range.setStart(orgn, orgo);
					this.range.setEnd(focn, foco);
				}
				catch (e) {}
				
				this.selection.addRange();
			}).bind(this);
			
			this.caret.setOffset = (function(start, end)
			{
				if (typeof end == 'undefined') end = start;
				if (!this.focus.isFocused()) this.focus.setStart();

				var range = document.createRange();
				var sel = document.getSelection();
				var node, offset = 0;
				var walker = document.createTreeWalker(this.$editor[0], NodeFilter.SHOW_TEXT, null, null);

				while (node = walker.nextNode())
				{
					offset += node.nodeValue.length;
					// WoltLab fix below, remove this method once the issue has been resolved by Imperavi
					if (offset > start || (start === end && offset === start))
					//if (offset > start)
					{
						range.setStart(node, node.nodeValue.length + start - offset);
						start = Infinity;
					}

					if (offset >= end)
					{
						range.setEnd(node, node.nodeValue.length + end - offset);
						break;
					}
				}

				sel.removeAllRanges();
				sel.addRange(range);
			}).bind(this);
		},
		
		/**
		 * Partially overwrites the 'clean' module.
		 * 
		 *  - convert <div> to <p> during paste
		 */
		clean: function() {
			// these characters are replaced by this.clean.onSet() and this.clean.onPaste() -- #1980
			var $protectedSpecialCharacters = function(text) {
				text = text.replace(/\u201D/g, '__wcf_preserve_character_1__');
				text = text.replace(/\u201C/g, '__wcf_preserve_character_2__');
				text = text.replace(/\u2018/g, '__wcf_preserve_character_3__');
				text = text.replace(/\u2019/g, '__wcf_preserve_character_4__');
				
				return text;
			};
			
			var $restoreSpecialCharacters = function(text) {
				text = text.replace(/__wcf_preserve_character_1__/g, '\u201D');
				text = text.replace(/__wcf_preserve_character_2__/g, '\u201C');
				text = text.replace(/__wcf_preserve_character_3__/g, '\u2018');
				text = text.replace(/__wcf_preserve_character_4__/g, '\u2019');
				
				return text;
			};
			
			// clean.onPaste
			var $mpOnPaste = this.clean.onPaste;
			this.clean.onPaste = (function(html, setMode) {
				this.opts.replaceDivs = true;
				
				html = $protectedSpecialCharacters(html);
				
				html = $mpOnPaste.call(this, html, setMode);
				
				this.opts.replaceDivs = false;
				
				return $restoreSpecialCharacters(html);
			}).bind(this);
			
			// clean.onPasteRemoveEmpty
			this.clean.onPasteRemoveEmpty = function(html) {
				return html.replace(/<br\s?\/?>$/i, '');
			};
			
			// clean.removeSpaces
			var mpRemoveSpaces = this.clean.removeSpaces;
			this.clean.removeSpaces = (function(html) {
				html = html.replace(/\u200C/g, '__wcf_zwnj__');
				html = html.replace(/\u200D/g, '__wcf_zwj__');
				
				html = mpRemoveSpaces.call(this, html);
				
				html = html.replace(/__wcf_zwnj__/g, '\u200C');
				return html.replace(/__wcf_zwj__/g, '\u200D');
			});
			
			// clean.onSet
			var $mpOnSet = this.clean.onSet;
			this.clean.onSet = (function(html) {
				html = $protectedSpecialCharacters(html);
				
				html = $mpOnSet.call(this, html);
				
				return $restoreSpecialCharacters(html);
			}).bind(this);
		},
		
		/**
		 * Partially overwrites the 'code' module.
		 * 
		 *  - Redactor internally caches the code and does not flush to textarea if it was not changed, force flushing
		 */
		code: function() {
			// code.startSync
			var $mpStartSync = this.code.startSync;
			this.code.startSync = (function() {
				// the editor internally caches if it needs to sync, thus we need to reset the internal cache to force a sync
				this.code.syncCode = undefined;
				
				$mpStartSync.call(this);
			}).bind(this);
			
			// code.textareaIndenting
			var $mpTextareaIndenting = this.code.textareaIndenting;
			this.code.textareaIndenting = (function(e) {
				if (e.keyCode !== 9 || e.ctrlKey) {
					return true;
				}
				
				return $mpTextareaIndenting.call(this, e);
			}).bind(this);
			
			// code.showCode
			// fixes an issue related to setSelectionRange on a hidden textarea in Firefox (NS_ERROR_FAILURE, #1984)
			var $mpShowCode = this.code.showCode;
			this.code.showCode = (function() {
				var height = this.$editor.innerHeight(), hiddenParent = null;
				if (!this.$textarea.is(':visible')) {
					hiddenParent = this.$textarea.parentsUntil(':visible').last();
					hiddenParent.show();
				}
				
				$mpShowCode.call(this);
				
				// jQuery's .height() seems to add the paddings
				this.$textarea[0].style.setProperty('height', height + 'px');
				
				if (hiddenParent !== null) {
					hiddenParent.hide();
				}
			}).bind(this);
		},
		
		/**
		 * Partially overwrites the 'dropdown' module.
		 * 
		 *  - emulate WCF-like dropdowns.
		 *  - save text selection on iOS (#2003)
		 */
		dropdown: function() {
			// dropdown.build
			this.dropdown.build = (function(name, $dropdown, dropdownObject) {
				$dropdown.addClass('dropdownMenu');
				
				$.each(dropdownObject, (function(btnName, btnObject) {
					if (btnName == 'dropdownDivider') {
						$('<li class="dropdownDivider" />').appendTo($dropdown);
					}
					else {
						var $listItem = $('<li />');
						var $item = $('<a href="#" class="redactor-dropdown-' + btnName + '">' + btnObject.title + '</a>');
						
						$item.on('click', $.proxy(function(e) {
							e.preventDefault();
							
							var type = 'func';
							var callback = btnObject.func;
							if (btnObject.command) {
								type = 'command';
								callback = btnObject.command;
							}
							else if (btnObject.dropdown) {
								type = 'dropdown';
								callback = btnObject.dropdown;
							}
							
							this.button.onClick(e, btnName, type, callback);
							this.dropdown.hideAll();
						}, this));
						
						$item.appendTo($listItem);
						$listItem.appendTo($dropdown);
					}
				}).bind(this));
			}).bind(this);
			
			// dropdown.show
			var $mpShow = this.dropdown.show;
			this.dropdown.show = $.proxy(function(e, key) {
				var $dropdown = this.button.get(key).data('dropdown');
				$fixDropdown($dropdown);
				
				if ($.browser.iOS) {
					this.wutil.saveSelection();
				}
				
				$mpShow.call(this, e, key);
				
				$dropdown.off('mouseover mouseout');
			}, this);
			
			// fix existing dropdowns
			var $fixDropdown = function(dropdown) {
				if (dropdown.hasClass('dropdownMenu')) {
					return;
				}
				
				dropdown.addClass('dropdownMenu');
				var $items = dropdown.children('a').detach();
				for (var $i = 0; $i < $items.length; $i++) {
					var $item = $('<li />').appendTo(dropdown);
					$item.append($items[$i]);
				}
			};
		},
		
		/**
		 * Partially overwrites the 'image' module.
		 * 
		 *  - WCF-like dialog behavior
		 */
		image: function() {
			// image.setEditable
			var $mpSetEditable = this.image.setEditable;
			this.image.setEditable = (function($image) {
				if ($image.hasClass('smiley')) {
					return;
				}
				
				// workaround for #2675
				$image.off('click.redactor touchstart.redactor');
				
				$mpSetEditable.call(this, $image);
			}).bind(this);
			
			// image.loadEditableControls
			var $mpLoadEditableControls = this.image.loadEditableControls;
			this.image.loadEditableControls = (function($image) {
				if ($image[0].parentNode.id === 'redactor-image-box') {
					return $('#redactor-image-resizer', this.$editor[0]);
				}
				
				var $returnValue = $mpLoadEditableControls.call(this, $image);
				
				if ($image.hasClass('redactorDisableResize') && $returnValue !== false) {
					$returnValue.hide();
				}
				
				return $returnValue;
			}).bind(this);
			
			// image.show
			this.image.show = (function() {
				this.modal.load('image', this.lang.get('image'), 0);
				var $button = this.modal.createActionButton(this.lang.get('insert'));
				$button.click($.proxy(this.wbutton._insertImage, this));
				
				$('#redactorImageLinkHrefContainer').hide();
				
				this.selection.save();
				this.modal.show();
			}).bind(this);
			
			// image.showEdit
			this.image.showEdit = (function(image) {
				this.modal.load('imageEdit', this.lang.get('edit'), 0);
				this.image.buttonSave = this.modal.createActionButton(this.lang.get('save'));
				
				this.image.buttonSave.click((function() {
					this.image.update(image);
				}).bind(this));
				
				var link = image.closest('a', this.$editor[0]);
				
				// set overlay values
				$('#redactor-image-link-source').val(image.attr('src'));
				$('#redactor-image-link-href').val(link.length ? link.attr('href') : '');
				$('#redactor-image-align').val(image.css('float'));
				
				this.modal.show();
				
				setTimeout(function() { $('.redactor-link-tooltip').remove(); }, 1);
			}).bind(this);
			
			// image.update
			this.image.update = (function(image) {
				this.image.hideResize();
				this.buffer.set();
				
				image.attr('src', $('#redactor-image-link-source').val());
				this.image.setFloating(image);
				
				var link = $('#redactor-image-link-href').val().trim();
				var anchor = image.closest('a', this.$editor[0]);
				
				if (anchor.length) {
					if (link === '') {
						anchor = anchor[0];
						var i = anchor.children.length, parent = anchor.parentNode;
						while (i--) {
							parent.insertBefore(anchor.children[0], anchor);
						}
						
						parent.removeChild(anchor);
					}
					else {
						anchor.attr('href', link);
					}
				}
				else if (link !== '') {
					anchor = document.createElement('a');
					anchor.href = link;
					image[0].parentNode.insertBefore(anchor, image[0]);
					anchor.appendChild(image[0]);
				}
				
				this.modal.close();
				this.observe.images();
			}).bind(this);
		},
		
		/**
		 * Partially overwrites the 'indent' module.
		 * 
		 *  - prevent browsers from screwing up the DOM when indenting the only item
		 */
		indent: function() {
			// indent.increaseLists
			var $mpIncrease = this.indent.increase;
			this.indent.increase = (function() {
				var $block = this.selection.getBlock();
				if ($block && $block.tagName === 'LI') {
					// do not allow indenting the first list item because it yields invalid HTML
					if ($block.parentElement.firstChild !== $block) {
						$mpIncrease.call(this);
					}
				}
			}).bind(this);
		},
		
		/**
		 * Partially overwrites the 'inline' module.
		 * 
		 *  - restore the text selection on iOS (#2003)
		 */
		inline: function() {
			// inline.format
			var $mpFormat = this.inline.format;
			this.inline.format = (function(tag, type, value) {
				if ($.browser.iOS) {
					this.wutil.restoreSelection();
				}
				
				$mpFormat.call(this, tag, type, value);
			}).bind(this);
			
			// inline.removeStyleRule
			var $mpRemoveStyleRule = this.inline.removeStyleRule;
			this.inline.removeStyleRule = (function(name) {
				if ($.browser.iOS) {
					this.wuil.restoreSelection();
				}
				
				$mpRemoveStyleRule.call(this, name);
			}).bind(this);
		},
		
		/**
		 * Partially overwrites the 'insert' module.
		 * 
		 *  - fixes insertion in an empty editor w/o prior focus until the issue has been resolved by Imperavi
		 */
		insert: function() {
			var isWebKit = ($.browser.webkit || document.documentElement.style.hasOwnProperty('WebkitAppearance') || window.hasOwnProperty('chrome'));
			
			var focusEditor = (function(html) {
				var $html = this.$editor.html();
				if (this.utils.isEmpty($html)) {
					this.$editor.focus();
					this.wutil.selectionEndOfEditor();
				}
				else {
					if (document.activeElement !== this.$editor[0]) {
						this.wutil.restoreSelection();
					}
				}
			}).bind(this);
			
			// work-around for WebKit inserting lame spans
			// bug report: https://code.google.com/p/chromium/issues/detail?id=335955
			// based upon the idea: http://www.neotericdesign.com/blog/2013/3/working-around-chrome-s-contenteditable-span-bug
			var fixWebKit = (function() {
				var saveSelection = false;
				
				var elements = this.$editor[0].querySelector('span:not([data-verified="redactor"])');
				for (var i = 0, length = elements.length; i < length; i++) {
					elements[i].outerHTML = elements[i].innerHTML;
					saveSelection = true;
				}
				
				if (saveSelection) {
					this.wutil.saveSelection();
				}
			}).bind(this);
			
			// insert.html
			var mpHtml = this.insert.html;
			this.insert.html = (function(html, clean) {
				focusEditor(html);
				
				mpHtml.call(this, html, clean);
				
				this.wutil.saveSelection();
				
				if (isWebKit) {
					setTimeout(function() {
						fixWebKit();
					}, 10);
				}
			}).bind(this);
			
			// pasting in Safari is broken, try to avoid breaking everything and wait for Imperavi to address this bug
			if (navigator.userAgent.match(/safari/i)) {
				var mpExecHtml = this.insert.execHtml;
				this.insert.execHtml = (function(html) {
					try {
						mpExecHtml.call(this, html);
					}
					catch (e) {
						console.debug("[Redactor.wmonkeypatch] Suppressed error in Safari: " + e.message);
					}
				}).bind(this);
			}
		},
		
		/**
		 * Partially overwrites the 'keydown' module.
		 * 
		 *  - improve behavior in quotes
		 *  - allow indentation for lists only
		 */
		keydown: function() {
			this.keydown.enterWithinBlockquote = false;
			
			// keydown.onTab
			var mpOnTab = this.keydown.onTab;
			this.keydown.onTab = (function(e, key) {
				var block = this.selection.getBlock();
				
				if (block && block.nodeName === 'LI') {
					return mpOnTab.call(this, e, key);
				}
				
				return true;
			}).bind(this);
			
			// keydown.replaceDivToParagraph
			var mpReplaceDivToParagraph = this.keydown.replaceDivToParagraph;
			this.keydown.replaceDivToParagraph = (function() {
				if (this.keydown.enterWithinBlockquote) {
					// do nothing and prevent replacement
					this.keydown.enterWithinBlockquote = false;
				}
				else {
					mpReplaceDivToParagraph.call(this);
				}
			}).bind(this);
			
			// keydown.setupBuffer
			var mpSetupBuffer = this.keydown.setupBuffer;
			this.keydown.setupBuffer = (function(e, key) {
				// undo
				if (this.keydown.ctrl && key === 89 && !e.shiftKey && !e.altKey && this.opts.rebuffer.length !== 0) {
					e.preventDefault();
					this.buffer.redo();
					return;
				}
				
				mpSetupBuffer.call(this, e, key);
			}).bind(this);
		},
		
		/**
		 * Partially overwrites the 'keyup' module.
		 * 
		 *  - prevent divs inside a quote being replace with paragraphs
		 */
		keyup: function() {
			// keyup.replaceToParagraph
			var mpReplaceToParagraph = this.keyup.replaceToParagraph;
			this.keyup.replaceToParagraph = (function(clone) {
				if (this.keyup.current.nodeName !== 'DIV' || !this.keyup.current.parentNode || this.keyup.current.parentNode.nodeName !== 'BLOCKQUOTE') {
					mpReplaceToParagraph.call(this, clone);
				}
			}).bind(this);
		},
		
		/**
		 * Partially overwrites the 'link' module.
		 * 
		 * - force consistent caret position upon link insert
		 */
		link: function() {
			// link.insert
			var mpInsert = this.link.insert;
			this.link.insert = (function() {
				mpInsert.call(this);
				
				this.selection.get();
				var container = this.selection.getCurrent();
				if (container.nodeType === Node.TEXT_NODE) {
					container = container.parentNode;
				}
				
				if (container.nodeName === 'A') {
					this.caret.setAfter(container);
				}
			}).bind(this);
		},
		
		/**
		 * Partially overwrites the 'modal' module.
		 * 
		 *  - delegate modal creation and handling to $.ui.wcfDialog.
		 */
		modal: function() {
			// modal.dialog
			this.modal.dialog = null;
			
			// modal.addTemplate
			var $mpAddTemplate = this.modal.addTemplate;
			this.modal.addTemplate = (function(name, template) {
				// overrides the 'table' template
				if (name !== 'table') {
					$mpAddTemplate.call(this, name, template);
				}
			}).bind(this);
			
			// modal.build
			this.modal.build = function() { /* does nothing */ };
			
			// modal.load
			this.modal.load = (function(templateName, title, width) {
				this.modal.templateName = templateName;
				this.modal.title = title;
				
				this.modal.dialog = $('<div />').hide().appendTo(document.body);
				this.modal.dialog.html(this.modal.getTemplate(this.modal.templateName));
				
				this.$modalFooter = null;
			}).bind(this);
			
			// modal.show
			this.modal.show = (function() {
				this.modal.dialog.wcfDialog({
					onClose: $.proxy(this.modal.close, this),
					title: this.modal.title
				});
				
				// focus first input field
				this.modal.dialog.find('input:first').focus();
			}).bind(this);
			
			// modal.createButton
			var $mpCreateButton = this.modal.createButton;
			this.modal.createButton = (function(label, className) {
				if (this.$modalFooter === null) {
					this.$modalFooter = $('<div class="formSubmit" />').appendTo(this.modal.dialog);
					this.modal.dialog.addClass('dialogForm');
				}
				
				return $mpCreateButton.call(this, label, className);
			}).bind(this);
			
			// modal.close
			this.modal.close = (function() {
				if (this.modal.dialog === null) {
					return;
				}
				
				try {
					this.modal.dialog.wcfDialog('close');
				}
				catch (e) {
					// ignore
				}
				finally {
					if (this.modal.dialog) {
						var $container = this.modal.dialog.parents('.dialogContainer:eq(0)');
						if ($container.length) {
							setTimeout(function() {
								$container.remove();
							}, 500);
						}
					}
				}
				
				this.modal.dialog = null;
			}).bind(this);
			
			// modal.createCancelButton
			this.modal.createCancelButton = function() { return $(); };
			
			// modal.createDeleteButton
			this.modal.createDeleteButton = function() { return $(); };
		},
		
		/**
		 * Partially overwrites the 'observe' module.
		 * 
		 *  - handles custom button active states.
		 */
		observe: function() {
			var $toggleButtons = (function(element, searchFor, buttonSelector, inverse, className, skipInSourceMode) {
				var $buttons = this.$toolbar.find(buttonSelector);
				if (element && element.closest(searchFor, this.$editor[0]).length != 0) {
					$buttons[(inverse ? 'removeClass' : 'addClass')](className);
				}
				else {
					if (skipInSourceMode && !this.opts.visual) {
						return;
					}
					
					$buttons[(inverse ? 'addClass' : 'removeClass')](className);
				}
			}).bind(this);
			
			// observe.buttons
			var $mpButtons = this.observe.buttons;
			this.observe.buttons = (function(e, btnName) {
				$mpButtons.call(this, e, btnName);
				
				var element = this.selection.getCurrent();
				if (element === false) {
					return;
				}
				
				if (element.nodeType === Node.TEXT_NODE) {
					element = element.parentNode;
				}
				
				if (element === this.$editor[0]) {
					return;
				}
				
				element = $(element);
				
				$toggleButtons(element, 'ul, ol', 'a.re-indent, a.re-outdent', true, 'redactor-button-disabled');
				$toggleButtons(element, 'kbd', 'a.re-__wcf_tt', false, 'redactor-act');
				$toggleButtons(element, 'blockquote.quoteBox', 'a.re-__wcf_quote', false, 'redactor-button-disabled', true);
				$toggleButtons(element, 'sub', 'a.re-subscript', false, 'redactor-act');
				$toggleButtons(element, 'sup', 'a.re-superscript', false, 'redactor-act');
			}).bind(this);
			
			// observe.load
			var $mpLoad = this.observe.load;
			this.observe.load = (function() {
				$mpLoad.call(this);
				
				WCF.System.Event.fireEvent('com.woltlab.wcf.redactor', 'observe_load_' + this.$textarea.wcfIdentify());
			}).bind(this);
			
			// observe.showTooltip
			var $mpShowTooltip = this.observe.showTooltip;
			this.observe.showTooltip = (function(e) {
				var $link = $(e.target);
				if (!$link.hasClass('redactorQuoteEdit')) {
					$mpShowTooltip.call(this, e);
				}
			}).bind(this);
		},
		
		/**
		 * Partially overwrites the 'paste' module.
		 * 
		 *  - prevent screwed up, pasted HTML from placing text nodes (and inline elements) in the editor's direct root
		 *  - fixes text pasting in Internet Explorer 11 (#2040) 
		 */
		paste: function() {
			// paste.createPasteBox
			var $mpCreatePasteBox = this.paste.createPasteBox;
			this.paste.createPasteBox = (function() {
				if ($.browser.iOS) {
					var $top = 0;
					if (window.getSelection().rangeCount) {
						var $container = window.getSelection().getRangeAt(0).endContainer;
						if ($container.nodeType !== Node.ELEMENT_NODE) {
							$container = $container.parentElement;
						}
						$container = $($container);
						
						$top = $($container).offset().top;
					}
					else {
						$top = $(window).scrollTop();
					}
					
					this.$pasteBox = $('<div>').html('').attr('contenteditable', 'true').css({ position: 'fixed', /*width: 0, */top: $top + 'px', /*left: '-9999px', */fontSize: '16px' });
					
					this.$box.parent().append(this.$pasteBox);
					this.$pasteBox.focus();
				}
				else {
					$mpCreatePasteBox.call(this);
				}
			}).bind(this);
			
			var $fixSelection = function() {
				var $selection = window.getSelection();
				if (!$selection.rangeCount) {
					return;
				}
				
				var $range = $selection.getRangeAt(0);
				if (!$range.collapsed) {
					return;
				}
				
				var $element = $range.startContainer;
				if ($element.nodeType === Node.ELEMENT_NODE && $element.tagName === 'DIV') {
					var $parentNode = $element.parentNode;
					if ($parentNode !== null && $parentNode.tagName === 'BLOCKQUOTE' && $parentNode.classList.contains('quoteBox')) {
						var $endContainer = $range.startContainer.childNodes[$range.startContainer.childNodes.length - 1];
						var $newRange = document.createRange();
						$newRange.setStart($range.startContainer.childNodes[0], 0);
						
						$newRange.setEnd($endContainer, $endContainer.length);
						$newRange.collapse(false);
						
						$selection.removeAllRanges();
						$selection.addRange($newRange);
					}
				}
			};
			
			// paste.insert
			var $mpInsert = this.paste.insert;
			this.paste.insert = (function(html) {
				$fixSelection();
				
				$mpInsert.call(this, html);
				
				setTimeout((function() {
					this.wutil.fixDOM();
					
					if ($.browser.msie) {
						getSelection().getRangeAt(0).collapse(false);
					}
					else if ($.browser.mozilla) {
						// bugfix for Firefox setting the caret somewhere in the void
						var $range = getSelection().getRangeAt(0);
						if ($range.startContainer === this.$editor[0] && $range.endContainer === this.$editor[0]) {
							this.wutil.selectionEndOfEditor();
						}
					}
					
					this.wutil.saveSelection();
				}).bind(this), 20);
			}).bind(this);
		},
		
		/**
		 * Partially overwrites the 'selection' module.
		 * 
		 *  - remove superflous empty text nodes caused by the selection markers (#2083)
		 */
		selection: function() {
			this.selection.implicitRange = null;
			
			var $removeEmptyTextNodes = (function(index, marker) {
				var $nextSibling = marker.nextSibling;
				if ($nextSibling !== null && $nextSibling.nodeType === Node.TEXT_NODE && $nextSibling.length === 0) {
					$($nextSibling).remove();
				}
				
				var $node = null;
				if ((marker.id === 'selection-marker-1' && !this.$editor.find('#selection-marker-2').length) || marker.id === 'nodes-marker-1' && !this.$editor.find('#nodes-marker-2').length) {
					$node = marker.previousSibling;
				}
				
				$(marker).remove();
				
				if ($node !== null) {
					this.selection.implicitRange = document.createRange();
					this.selection.implicitRange.setStart($node, $node.length);
					this.selection.implicitRange.setEnd($node, $node.length);
				}
				else {
					this.selection.implicitRange = null;
				}
			}).bind(this);
			
			// selection.removeMarkers
			this.selection.removeMarkers = (function() {
				this.$editor.find('span.redactor-selection-marker').each($removeEmptyTextNodes);
			}).bind(this);
			
			// selection.removeNodesMarkers
			this.selection.removeNodesMarkers = (function() {
				$(document).find('span.redactor-nodes-marker').each($removeEmptyTextNodes);
				this.$editor.find('span.redactor-nodes-marker').each($removeEmptyTextNodes);
			}).bind(this);
		},
		
		/**
		 * Partially overwrites the 'utils' module.
		 * 
		 *  - prevent removing of empty paragraphs/divs
		 */
		utils: function() {
			this.utils.removeEmpty = function(i, s) { /* does nothing */ };
		},
		
		/**
		 * Rebuilds certain templates provided by Redactor to better integrate into WCF.
		 */
		rebuildTemplates: function() {
			// template: image
			this.opts.modal.image =
				'<fieldset id="redactor-modal-image-edit">'
					+ '<dl>'
						+ '<dt><label for="redactor-image-link-source">' + WCF.Language.get('wcf.bbcode.image.source') + '</label></dt>'
						+ '<dd><input type="text" id="redactor-image-link-source" class="long"  /></dd>'
					+ '</dl>'
					+ '<dl id="redactorImageLinkHrefContainer">'
						+ '<dt><label for="redactor-image-link-href">' + this.lang.get('link') + '</label></dt>'
						+ '<dd><input type="text" id="redactor-image-link-href" class="long"  /></dd>'
					+ '</dl>'
					+ '<dl>'
						+ '<dt><label for="redactor-image-align">' + this.opts.curLang.image_position + '</label></dt>'
						+ '<dd>'
							+ '<select id="redactor-image-align">'
								+ '<option value="none">' + WCF.Language.get('wcf.global.noSelection') + '</option>'
								+ '<option value="left">' + this.lang.get('left') + '</option>'
								+ '<option value="right">' + this.lang.get('right') + '</option>'
							+ '</select>'
						+ '</dd>'
					+ '</dl>'
				+ '</fieldset>';
			
			// template: imageEdit
			this.opts.modal.imageEdit = this.opts.modal.image;
			
			// template: link
			this.opts.modal.link =
				'<fieldset id="redactor-modal-link">'
					+ '<dl>'
						+ '<dt><label for="redactor-link-url" />URL</label></dt>' /* TODO: use a phrase instead of hardcoding it! */
						+ '<dd><input type="url" id="redactor-link-url" class="long" /></dd>'
					+ '</dl>'
					+ '<dl>'
						+ '<dt><label for="redactor-link-url-text">' + this.lang.get('text') + '</label></dt>'
						+ '<dd><input type="text" id="redactor-link-url-text" class="long" /></dd>'
					+ '</dl>'
				+ '</fieldset>';
			
			// template: quote
			this.opts.modal.quote =
				'<fieldset>'
					+ '<dl>'
						+ '<dt><label for="redactorQuoteAuthor">' + WCF.Language.get('wcf.bbcode.quote.edit.author') + '</label></dt>'
						+ '<dd><input type="text" id="redactorQuoteAuthor" class="long" /></dd>'
					+ '</dl>'
					+ '<dl>'
						+ '<dt><label for="redactorQuoteLink">' + WCF.Language.get('wcf.bbcode.quote.edit.link') + '</label></dt>'
						+ '<dd><input type="text" id="redactorQuoteLink" class="long" /></dd>'
					+ '</dl>'
				+ '</fieldset>';
			
			// template: code
			var $highlighters = '';
			$.each(__REDACTOR_CODE_HIGHLIGHTERS, function(k, v) {
				if (k === 'plain') return true;
				
				$highlighters += '<option value="' + k + '">' + v + '</option>';
			});
			
			this.opts.modal.code =
				'<fieldset>'
					+ '<legend>' + WCF.Language.get('wcf.bbcode.code.settings') + '</legend>'
					+ '<dl>'
						+ '<dt><label for="redactorCodeHighlighter">' + WCF.Language.get('wcf.bbcode.code.highlighter') + '</label></dt>'
						+ '<dd>'
							+ '<select id="redactorCodeHighlighter">'
								+ '<option value="plain">' + WCF.Language.get('wcf.bbcode.code.highlighter.none') + '</option>'
								+ $highlighters
							+ '</select>'
							+ '<small>' + WCF.Language.get('wcf.bbcode.code.highlighter.description') + '</small>'
						+ '</dd>'
					+ '</dl>'
					+ '<dl>'
						+ '<dt><label for="redactorCodeLineNumber">' + WCF.Language.get('wcf.bbcode.code.lineNumber') + '</label></dt>'
						+ '<dd>'
							+ '<input type="number" id="redactorCodeLineNumber" min="1" max="99999" value="1" />'
							+ '<small>' + WCF.Language.get('wcf.bbcode.code.lineNumber.description') + '</small>'
						+ '</dd>'
					+ '</dl>'
					+ '<dl>'
						+ '<dt><label for="redactorCodeFilename">' + WCF.Language.get('wcf.bbcode.code.filename') + '</label></dt>'
						+ '<dd>'
							+ '<input type="text" id="redactorCodeFilename" value="" class="long" />'
							+ '<small>' + WCF.Language.get('wcf.bbcode.code.filename.description') + '</small>'
						+ '</dd>'
					+ '</dl>'
				+ '</fieldset>'
				+ '<fieldset>'
					+ '<legend>' + WCF.Language.get('wcf.bbcode.code') + '</legend>'
					+ '<dl class="wide">'
						+ '<dt></dt>'
						+ '<dd><textarea id="redactorCodeBox" class="long monospace" rows="12" /></dd>'
					+ '</dl>'
				+ '</fieldset>';
			
			// template: table
			this.opts.modal.table =
				'<fieldset id="redactor-modal-table-insert">'
					+ '<dl>'
						+ '<dt><label for="redactor-table-rows">' + this.lang.get('rows') + '</label></dt>'
						+ '<dd><input type="number" size="5" value="2" min="1" id="redactor-table-rows" class="tiny" /></dd>'
					+ '</dl>'
					+ '<dl>'
						+ '<dt><label for="redactor-table-columns">' + this.lang.get('columns') + '</label></dt>'
						+ '<dd><input type="number" size="5" value="3" min="1" id="redactor-table-columns" class="tiny" /></dd>'
					+ '</dl>'
				+ '</fieldset>';
		},
		
		/**
		 * Resolves issues in Chrome / WebKit based browsers
		 * 
		 * - Explicitly set CSS values for <span> within the editor, prevents Chrome from inserting random <span> tags
		 */
		fixWebKit: function() {
			return;
			if (!$.browser.webkit && !document.documentElement.style.hasOwnProperty('WebkitAppearance') && !window.hasOwnProperty('chrome')) {
				return;
			}
			
			// get styles
			var $default = {
				fontSize: this.$editor.css('font-size'),
				lineHeight: this.$editor.css('line-height')
			};
			
			var $editorID = this.$editor.wcfIdentify();
			var $style = document.createElement('style');
			$style.type = 'text/css';
			$style.innerHTML = '#' + $editorID + ' span { font-size: ' + $default.fontSize + '; line-height: ' + $default.lineHeight + ' }';
			document.head.appendChild($style);
		}
	};
};
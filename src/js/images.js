/*global MediumEditor*/

;(function ($, window, document, Util, undefined) {

    'use strict';

    /** Default values */
    var pluginName = 'mediumInsert',
        addonName = 'Images', // first char is uppercase
        defaults = {
            label: '<div class="icon icon-camera"></div>',
            deleteMethod: 'POST',
            deleteScript: 'delete.php',
            preview: true,
            captions: true,
            captionPlaceholder: 'Type caption for image (optional)',
            autoGrid: 3,

            // custom functions
            onPreviewLoaded: null,
            checkImageStyles: null,

            fileUploadOptions: { // See https://github.com/blueimp/jQuery-File-Upload/wiki/Options
                url: 'upload.php',
                acceptFileTypes: /(\.|\/)(gif|jpe?g|png)$/i
            },
            fileDeleteOptions: {},
            defaultStyle: 'wide',
            styles: {
                wide: {
                    label: '<svg viewBox="0 0 128 128" width="25" height="25"><use xlink:href="#justify-full"/></svg>',
                    // added: function ($el) {},
                    // removed: function ($el) {}
                },
                left: {
                    label: '<svg viewBox="0 0 128 128" width="25" height="25"><use xlink:href="#justify-left"/></svg>',
                    // added: function ($el) {},
                    // removed: function ($el) {}
                },
                right: {
                    label:  '<svg viewBox="0 0 128 128" width="25" height="25"><use xlink:href="#justify-right"/></svg>',
                    // added: function ($el) {},
                    // removed: function ($el) {}
                },
                'full-width': {
                    label: '<svg viewBox="0 0 128 128" width="25" height="25"><use xlink:href="#full-width"/></svg>',
                    // added: function ($el) {},
                    // removed: function ($el) {}
                },
                grid: {
                    label:  '<svg viewBox="0 0 128 128" width="25" height="25"><use xlink:href="#grid"/></svg>'
                    // added: function ($el) {},
                    // removed: function ($el) {}
                }
            },
            actions: {
                remove: {
                    label: '<svg viewBox="0 0 128 128" width="25" height="25"><use xlink:href="#remove"/></svg>',
                    clicked: function () {
                        var $event = $.Event('keydown');

                        $event.which = 8;
                        $(document).trigger($event);
                    }
                }
            },
            sorting: function () {
                var that = this;

                $('.medium-insert-images').sortable({
                    group: 'medium-insert-images',
                    containerSelector: '.medium-insert-images',
                    itemSelector: 'figure',
                    placeholder: '<figure class="placeholder">',
                    handle: 'img',
                    nested: false,
                    vertical: false,
                    afterMove: function () {
                        that.core.triggerInput();
                    }
                });
            },
            messages: {
                acceptFileTypesError: 'This file is not in a supported format: ',
                maxFileSizeError: 'This file is too big: '
            }
            // uploadCompleted: function ($el, data) {}
        };

    /**
     * Images object
     *
     * Sets options, variables and calls init() function
     *
     * @constructor
     * @param {DOM} el - DOM element to init the plugin on
     * @param {object} options - Options to override defaults
     * @return {void}
     */

    function Images (el, options) {
        this.el = el;
        this.$el = $(el);
        this.templates = window.MediumInsert.Templates;
        this.core = this.$el.data('plugin_'+ pluginName);

        this.options = $.extend(true, {}, defaults, options);

        this._defaults = defaults;
        this._name = pluginName;

        // Allow image preview only in browsers, that support's that
        if (this.options.preview && !window.FileReader) {
            this.options.preview = false;
        }

        // Extend editor's functions
        if (this.core.getEditor()) {
            this.core.getEditor()._serializePreImages = this.core.getEditor().serialize;
            this.core.getEditor().serialize = this.editorSerialize;
        }

        this.init();
    }

    /**
     * Initialization
     *
     * @return {void}
     */

    Images.prototype.init = function () {
        var $images = this.$el.find('.medium-insert-images');

        $images.find('figcaption').attr('contenteditable', true);
        $images.find('figure').attr('contenteditable', false);

        this.events();
        this.backwardsCompatibility();
        this.sorting();
    };

    /**
     * Event listeners
     *
     * @return {void}
     */

    Images.prototype.events = function () {
        $(document)
            .on('click', $.proxy(this, 'unselectImage'))
            .on('keydown', $.proxy(this, 'removeImage'))
            .on('click', '.medium-insert-images-toolbar .medium-editor-action', $.proxy(this, 'toolbarAction'))
            .on('click', '.medium-insert-images-toolbar2 .medium-editor-action', $.proxy(this, 'toolbar2Action'));

        this.$el
            .on('click', '.medium-insert-images img', $.proxy(this, 'selectImage'));
    };

    /**
     * Replace v0.* class names with new ones
     *
     * @return {void}
     */

    Images.prototype.backwardsCompatibility = function () {
        this.$el.find('.mediumInsert')
            .removeClass('mediumInsert')
            .addClass('medium-insert-images');

        this.$el.find('.medium-insert-images.small')
            .removeClass('small')
            .addClass('medium-insert-images-left');
    };

    /**
     * Extend editor's serialize function
     *
     * @return {object} Serialized data
     */

    Images.prototype.editorSerialize = function () {
        var data = this._serializePreImages();

        $.each(data, function (key) {
            var $data = $('<div />').html(data[key].value);

            $data.find('.medium-insert-images').find('figcaption, figure').removeAttr('contenteditable');

            data[key].value = $data.html();
        });

        return data;
    };

    /**
     * Add image
     *
     * @return {void}
     */

    Images.prototype.add = function () {
        var originalAdd = this.options.fileUploadOptions.add,
            originalDone = this.options.fileUploadOptions.done;

        var that = this,
            $file = $(this.templates['src/js/templates/images-fileupload.hbs']()),
            fileUploadOptions = {
                dataType: 'json',
                add: function (e, data) {
                    if (typeof originalAdd === 'function') {
                        originalAdd.call(that, e, data);
                    }
                    $.proxy(that, 'uploadAdd', e, data)();
                },
                done: function (e, data) {
                    if (typeof originalDone === 'function') {
                        originalDone.call(that, e, data);
                    }
                    $.proxy(that, 'uploadDone', e, data)();
                }
            };

        if (typeof this.options.fileUploadOptions.url === 'function') {
            fileUploadOptions.url = this.options.fileUploadOptions.url();
        }

        // Only add progress callbacks for browsers that support XHR2,
        // and test for XHR2 per:
        // http://stackoverflow.com/questions/6767887/
        // what-is-the-best-way-to-check-for-xhr2-file-upload-support
        if (new XMLHttpRequest().upload) {
            fileUploadOptions.progress = function (e, data) {
                $.proxy(that, 'uploadProgress', e, data)();
            };

            fileUploadOptions.progressall = function (e, data) {
                $.proxy(that, 'uploadProgressall', e, data)();
            };
        }

        $file.fileupload($.extend(true, {}, this.options.fileUploadOptions, fileUploadOptions));

        $file.click();
    };

    /**
     * Callback invoked as soon as files are added to the fileupload widget - via file input selection, drag & drop or add API call.
     * https://github.com/blueimp/jQuery-File-Upload/wiki/Options#add
     *
     * @param {Event} e
     * @param {object} data
     * @return {void}
     */

    Images.prototype.uploadAdd = function (e, data) {
        var $place = this.$el.find('.medium-insert-active'),
            that = this,
            uploadErrors = [],
            file = data.files[0],
            acceptFileTypes = this.options.fileUploadOptions.acceptFileTypes,
            maxFileSize = this.options.fileUploadOptions.maxFileSize,
            reader;

        if (acceptFileTypes && !acceptFileTypes.test(file['type'])) {
            uploadErrors.push(this.options.messages.acceptFileTypesError + file['name']);
        } else if (maxFileSize && file['size'] > maxFileSize) {
            uploadErrors.push(this.options.messages.maxFileSizeError + file['name']);
        }
        if (uploadErrors.length > 0) {
            alert(uploadErrors.join("\n"));
            return;
        }

        this.core.hideButtons();

        // Replace paragraph with div, because figure elements can't be inside paragraph
        if ($place.is('p')) {
            $place.replaceWith('<div class="medium-insert-active">'+ $place.html() +'</div>');
            $place = this.$el.find('.medium-insert-active');
            this.core.moveCaret($place);
        }

        $place.addClass('medium-insert-images');

        if (this.options.preview === false && $place.find('progress').length === 0 && (new XMLHttpRequest().upload)) {
            $place.append(this.templates['src/js/templates/images-progressbar.hbs']());
        }

        if (data.autoUpload || (data.autoUpload !== false && $(e.target).fileupload('option', 'autoUpload'))) {
            data.process().done(function () {
                // If preview is set to true, let the showImage handle the upload start
                if (that.options.preview) {
                    reader = new FileReader();

                    reader.onload = function (e) {
                        $.proxy(that, 'showImage', e.target.result, data)();


                        var image = new Image();
                        image.src = e.target.result;

                        image.onload = function () {
                            if (typeof that.options.onPreviewLoaded === 'function') {
                                that.options.onPreviewLoaded(image, data);
                            }
                            data.submit();
                        };
                    };

                    reader.readAsDataURL(data.files[0]);
                } else {
                    data.submit();
                }
            });
        }
    };

    /**
     * Callback for global upload progress events
     * https://github.com/blueimp/jQuery-File-Upload/wiki/Options#progressall
     *
     * @param {Event} e
     * @param {object} data
     * @return {void}
     */

    Images.prototype.uploadProgressall = function (e, data) {
        var progress, $progressbar;

        if (this.options.preview === false) {
            progress = parseInt(data.loaded / data.total * 100, 10);
            $progressbar = this.$el.find('.medium-insert-active').find('progress');

            $progressbar
                .attr('value', progress)
                .text(progress);

            if (progress === 100) {
                $progressbar.remove();
            }
        }
    };

    /**
     * Callback for upload progress events.
     * https://github.com/blueimp/jQuery-File-Upload/wiki/Options#progress
     *
     * @param {Event} e
     * @param {object} data
     * @return {void}
     */

    Images.prototype.uploadProgress = function (e, data) {
        var progress, $progressbar;

        if (this.options.preview) {
            progress = 100 - parseInt(data.loaded / data.total * 100, 10);
            $progressbar = data.context.find('.medium-insert-images-progress');

            $progressbar.css('width', progress +'%');

            if (progress === 0) {
                $progressbar.remove();
            }
        }
    };

    /**
     * Callback for successful upload requests.
     * https://github.com/blueimp/jQuery-File-Upload/wiki/Options#done
     *
     * @param {Event} e
     * @param {object} data
     * @return {void}
     */

    Images.prototype.uploadDone = function (e, data) {
        var $el = $.proxy(this, 'showImage', data.result.url, data)();

        this.core.clean();
        this.sorting();

        if (this.options.uploadCompleted) {
            this.options.uploadCompleted($el, data);
        }
    };

    /**
     * Add uploaded / preview image to DOM
     *
     * @param {string} img
     * @returns {void}
     */

    Images.prototype.showImage = function (img, data) {
        var $place = this.$el.find('.medium-insert-active'),
            domImage,
            that;

        // Hide editor's placeholder
        $place.click();

        // If preview is allowed and preview image already exists,
        // replace it with uploaded image
        that = this;
        if (this.options.preview && data.context) {
            domImage = this.getDOMImage();
            domImage.onload = function () {
                data.context.find('img').attr('src', domImage.src).attr('img-id', domImage.getAttribute('img-id'));
                that.core.triggerInput();

                // if (typeof that.options.uploadCompleted === 'function') {
                //     that.options.uploadCompleted(that.$el, data);
                // }
            };
            domImage.setAttribute('img-id', data.result.id);
            domImage.src = img;
        } else {
            data.context = $(this.templates['src/js/templates/images-image.hbs']({
                id: data.result ? data.result.id : '',
                img: img,
                progress: this.options.preview
            })).appendTo($place);

            $place.find('br').remove();

            if (this.options.autoGrid && $place.find('figure').length >= this.options.autoGrid) {
                $.each(this.options.styles, function (style, options) {
                    var className = 'medium-insert-images-'+ style;

                    $place.removeClass(className);

                    if (options.removed) {
                        options.removed($place);
                    }
                });

                $place.addClass('medium-insert-images-grid');

                if (this.options.styles.grid.added) {
                    this.options.styles.grid.added($place);
                }
            }

            // if (this.options.preview) {
            //     data.submit();
            // }
        }

        this.core.triggerInput();

        return data.context;
    };

    Images.prototype.getDOMImage = function () {
        return new window.Image();
    };

    /**
     * Select clicked image
     *
     * @param {Event} e
     * @returns {void}
     */

    Images.prototype.selectImage = function (e) {
        if(this.core.options.enabled) {
            var $image = $(e.target),
                that = this;

            // Hide keyboard on mobile devices
            this.$el.blur();

            $image.addClass('medium-insert-image-active');
            $image.closest('.medium-insert-images').addClass('medium-insert-active');

            setTimeout(function () {
                that.addToolbar();

                if (that.options.captions) {
                    that.core.addCaption($image.closest('figure'), that.options.captionPlaceholder);
                }
            }, 50);
        }
    };

    /**
     * Unselect selected image
     *
     * @param {Event} e
     * @returns {void}
     */

    Images.prototype.unselectImage = function (e) {
        var $el = $(e.target),
            $image = this.$el.find('.medium-insert-image-active');

        if ($el.is('img') && $el.hasClass('medium-insert-image-active')) {
            $image.not($el).removeClass('medium-insert-image-active');
            $('.medium-insert-images-toolbar, .medium-insert-images-toolbar2').remove();
            this.core.removeCaptions($el);
            return;
        }

        $image.removeClass('medium-insert-image-active');
        $('.medium-insert-images-toolbar, .medium-insert-images-toolbar2').remove();

        if ($el.is('.medium-insert-caption-placeholder')) {
            this.core.removeCaptionPlaceholder($image.closest('figure'));
        } else if ($el.is('figcaption') === false) {
            this.core.removeCaptions();
        }
    };

    /**
     * Remove image
     *
     * @param {Event} e
     * @returns {void}
     */

    Images.prototype.removeImage = function (e) {
        var $image, $parent, $empty;

        if (e.which === 8 || e.which === 46) {
            $image = this.$el.find('.medium-insert-image-active');

            if ($image.length) {
                e.preventDefault();

                this.deleteFile($image);

                $parent = $image.closest('.medium-insert-images');
                $image.closest('figure').remove();

                $('.medium-insert-images-toolbar, .medium-insert-images-toolbar2').remove();

                if ($parent.find('figure').length === 0) {
                    $empty = $parent.next();
                    if ($empty.is('p') === false || $empty.text() !== '') {
                        $empty = $(this.templates['src/js/templates/core-empty-line.hbs']().trim());
                        $parent.before($empty);
                    }
                    $parent.remove();

                    // Hide addons
                    this.core.hideAddons();

                    this.core.moveCaret($empty);
                }

                this.core.triggerInput();
            }
        }
    };

    /**
     * Makes ajax call to deleteScript
     *
     * @param {String} file File name
     * @returns {void}
     */

    Images.prototype.deleteFile = function (imageElement) {
        if (this.options.deleteScript) {
            // If deleteMethod is somehow undefined, defaults to POST
            var url = typeof this.options.deleteScript === 'function' ?
                this.options.deleteScript(imageElement) : this.options.deleteScript;
            var method = this.options.deleteMethod || 'POST';

            $.ajax($.extend(true, {}, {
                url: url,
                type: method
            }, this.options.fileDeleteOptions));
        }
    };

    /**
     * Adds image toolbar to editor
     *
     * @returns {void}
     */

    Images.prototype.addToolbar = function () {
        var $image = this.$el.find('.medium-insert-image-active'),
            $p = $image.closest('.medium-insert-images'),
            active = false,
            $toolbar, $toolbar2, top,
            styles = $.extend(true, {}, this.options.styles);

        if (typeof this.options.checkImageStyles === 'function') {
            this.options.checkImageStyles($image.get(0), styles);
        }

        var mediumEditor = this.core.getEditor();
        var toolbarContainer = mediumEditor.options.elementsContainer || 'body';

        $(toolbarContainer).append(this.templates['src/js/templates/images-toolbar.hbs']({
            styles: styles,
            actions: this.options.actions
        }).trim());

        $toolbar = $('.medium-insert-images-toolbar');
        $toolbar2 = $('.medium-insert-images-toolbar2');

        top = $image.offset().top - $toolbar.height() - 8 - 2 - 5; // 8px - hight of an arrow under toolbar, 2px - height of an image outset, 5px - distance from an image
        if (top < 0) {
            top = 0;
        }

        $toolbar
            .css({
                top: top,
                left: $image.offset().left + $image.width() / 2 - $toolbar.width() / 2
            })
            .show();

        $toolbar2
            .css({
                top: $image.offset().top + 2, // 2px - distance from a border
                left: $image.offset().left + $image.width() - $toolbar2.width() - 4 // 4px - distance from a border
            })
            .show();

        $toolbar.find('button').each(function () {
            if ($p.hasClass('medium-insert-images-'+ $(this).data('action'))) {
                $(this).addClass('medium-editor-button-active');
                active = true;
            }
        });

        if (active === false) {
            $toolbar.find('button').first().addClass('medium-editor-button-active');
        }
    };

    /**
     * Fires toolbar action
     *
     * @param {Event} e
     * @returns {void}
     */

    Images.prototype.toolbarAction = function (e) {
        var $button = $(e.target).is('button') ? $(e.target) : $(e.target).closest('button'),
            $li = $button.closest('li'),
            $ul = $li.closest('ul'),
            $lis = $ul.find('li'),
            $p = this.$el.find('.medium-insert-active'),
            that = this;

        $button.addClass('medium-editor-button-active');
        $li.siblings().find('.medium-editor-button-active').removeClass('medium-editor-button-active');

        $lis.find('button').each(function () {
            var className = 'medium-insert-images-'+ $(this).data('action');

            if ($(this).hasClass('medium-editor-button-active')) {
                $p.addClass(className);

                if (that.options.styles[$(this).data('action')].added) {
                    that.options.styles[$(this).data('action')].added($p);
                }
            } else {
                $p.removeClass(className);

                if (that.options.styles[$(this).data('action')].removed) {
                    that.options.styles[$(this).data('action')].removed($p);
                }
            }
        });

        this.core.hideButtons();

        this.core.triggerInput();
    };

    /**
     * Fires toolbar2 action
     *
     * @param {Event} e
     * @returns {void}
     */

    Images.prototype.toolbar2Action = function (e) {
        var $button = $(e.target).is('button') ? $(e.target) : $(e.target).closest('button'),
            callback = this.options.actions[$button.data('action')].clicked;

        if (callback) {
            callback(this.$el.find('.medium-insert-image-active'));
        }

        this.core.hideButtons();

        this.core.triggerInput();
    };

    /**
     * Initialize sorting
     *
     * @returns {void}
     */

    Images.prototype.sorting = function () {
        $.proxy(this.options.sorting, this)();
    };

    /** Plugin initialization */

    $.fn[pluginName + addonName] = function (options) {
        return this.each(function () {
            if (!$.data(this, 'plugin_' + pluginName + addonName)) {
                $.data(this, 'plugin_' + pluginName + addonName, new Images(this, options));
            }
        });
    };

})(jQuery, window, document, MediumEditor.util);

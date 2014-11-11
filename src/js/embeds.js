;(function ($, window, document, undefined) {

    'use strict';

    /** Default values */
    var pluginName = 'mediumInsert',
        addonName = 'Embeds', // first char is uppercase
        defaults = {
            label: '<span class="fa fa-youtube-play"></span>',
            placeholder: 'Paste a YouTube, Vimeo, Facebook, Twitter or Instagram link and press Enter',
            oembedProxy: 'http://medium.iframe.ly/api/oembed?iframe=1'
        };

    /**
     * Embeds object
     *
     * Sets options, variables and calls init() function
     *
     * @constructor
     * @param {DOM} el - DOM element to init the plugin on
     * @param {object} options - Options to override defaults
     * @return {void}
     */

    function Embeds (el, options) {
        this.el = el;
        this.$el = $(el);
        this.templates = window.MediumInsert.Templates;

        this.options = $.extend(true, {}, defaults, options) ;

        this._defaults = defaults;
        this._name = pluginName;

        this.init();
    }

    /**
     * Initialization
     *
     * @return {void}
     */

    Embeds.prototype.init = function () {
        this.events();
    };

    /**
     * Event listeners
     *
     * @return {void}
     */

    Embeds.prototype.events = function () {
        this.$el
            .on('selectstart mousedown', '.medium-insert-embeds-placeholder', $.proxy(this, 'disablePlaceholderSelection'))
            .on('keyup click', $.proxy(this, 'togglePlaceholder'))
            .on('keydown', $.proxy(this, 'processLink'));
    };    
    
    /**
     * Add embedded element
     *
     * @return {void}
     */
    
    Embeds.prototype.add = function () {   
        var $place = this.$el.find('.medium-insert-active');
                     
        $place.addClass('medium-insert-embeds-input medium-insert-embeds-active');
            
        this.togglePlaceholder({ target: $place.get(0) });
        
        $place.click();
    };

    /**
     * Disable placeholder selection, instead move cursor to input
     *
     * @param {Event} e
     * @return {void}
     */
    
    Embeds.prototype.disablePlaceholderSelection = function (e) {
        var $place = $(e.target).closest('.medium-insert-embeds-input'),
            range, sel;
        
        e.preventDefault();
        e.stopPropagation();
        
        $place.prepend('&nbsp;');

        // Place caret at the beginning of embeds
        range = document.createRange();
        sel = window.getSelection();
        range.setStart($place.get(0).childNodes[0], 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    };

    /**
     * Toggles placeholder
     *
     * @param {Event} e
     * @return {void}
     */    
    
    Embeds.prototype.togglePlaceholder = function (e) {
        var $place = $(e.target),
            selection = window.getSelection(),
            range = selection.getRangeAt(0),
            $current = $(range.commonAncestorContainer),
            $placeholder, re, text;

        if ($current.hasClass('medium-insert-embeds-active')) {
            $place = $current;
        } else if ($current.closest('.medium-insert-embeds-active').length) {
            $place = $current.closest('.medium-insert-embeds-active');
        }

        if ($place.hasClass('medium-insert-embeds-active')) {
            
            $placeholder = $place.find('.medium-insert-embeds-placeholder');
            re = new RegExp(this.options.placeholder, 'g');
            text = $place.text().replace(re, '').trim();

            if (text === '' && $placeholder.length === 0) {
                $place.append(this.templates['src/js/templates/embeds-placeholder.hbs']({
                    placeholder: this.options.placeholder
                }));
            } else if (text !== '' && $placeholder.length) {
                $placeholder.remove();
            }
            
        } else {
            this.$el.find('.medium-insert-embeds-active').remove();
        }
    };
    
    /**
     * Process link
     *
     * @param {Event} e
     * @return {void}
     */
    
    Embeds.prototype.processLink = function (e) {
        var $place = this.$el.find('.medium-insert-embeds-active'),
            that = this,
            re, url, html;

        if ($place.length) {
            
            re = new RegExp(this.options.placeholder, 'g');
            url = $place.text().replace(re, '').trim();
            
            // Backspace and delete
            if (e.which === 8 || e.keyCode === 8 || e.which === 46 || e.keyCode === 46) {
                if (url === '') {
                    $place.remove();
                }
            // Enter
            } else if (e.which === 13 || e.keyCode === 13) {
                if (url === '') {
                    $place.remove();
                } else {
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (this.options.oembedProxy) {
                        this.getOembedHTML(url, function (error, oebmed) {
                            var html = !error && oebmed && oebmed.html;

                            if (oebmed && !oebmed.html && oebmed.type === 'photo' && oebmed.url) {
                                html = '<img src="' + oebmed.url + '" />';
                            }

                            $.proxy(that, 'embed', html)();
                        });
                    } else {
                        html = this.getEmbedHTML(url);
                        this.embed(html);
                    }
                    
                }
            }
            
        }
    };
    
    /**
     * Get HTML via oEmbed proxy
     *
     * @param {string} url
     * @param {function} callback
     * @return {void}
     */
    
    Embeds.prototype.getOembedHTML = function (url, callback) {        
        $.ajax({
            url: this.options.oembedProxy,
            dataType: "json",
            data: {
                url: url
            },
            success: function(data, textStatus, jqXHR) {
                callback(null, data, jqXHR);
            },
            error: function(jqXHR, textStatus, errorThrown) {
                var responseJSON = (function() {
                    try {
                        return JSON.parse(jqXHR.responseText);
                    } catch(e) {}
                })();

                callback((responseJSON && responseJSON.error) || jqXHR.status || errorThrown.message, responseJSON, jqXHR);
            }
        });        
    };
    
    /**
     * Get HTML using regexp
     *
     * @param {string} url
     * @return {string}
     */
    
    Embeds.prototype.getEmbedHTML = function (url) {
        var embed_tag;
        
        // We didn't get something we expect so let's get out of here.
        if (!(new RegExp(['youtube', 'yout.be', 'vimeo', 'twitter', 'facebook', 'instagram'].join("|")).test(url))) {
            return false;
        }

        embed_tag = url.replace(/\n?/g, '')
            .replace(/^((http(s)?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|v\/)?)([a-zA-Z0-9\-_]+)(.*)?$/, '<div class="video"><iframe width="420" height="315" src="//www.youtube.com/embed/$7" frameborder="0" allowfullscreen></iframe></div>')
            .replace(/^http:\/\/vimeo\.com(\/.+)?\/([0-9]+)$/, '<iframe src="//player.vimeo.com/video/$2" width="500" height="281" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>')
            .replace(/^https:\/\/twitter\.com\/(\w+)\/status\/(\d+)\/?$/, '<blockquote class="twitter-tweet" align="center" lang="en"><a href="https://twitter.com/$1/statuses/$2"></a></blockquote><script async src="//platform.twitter.com/widgets.js" charset="utf-8"></script>')
            .replace(/^https:\/\/www\.facebook\.com\/(video.php|photo.php)\?v=(\d+).+$/, '<div class="fb-post" data-href="https://www.facebook.com/photo.php?v=$2"><div class="fb-xfbml-parse-ignore"><a href="https://www.facebook.com/photo.php?v=$2">Post</a></div></div>')
            .replace(/^http:\/\/instagram\.com\/p\/(.+)\/?$/, '<span class="instagram"><iframe src="//instagram.com/p/$1/embed/" width="612" height="710" frameborder="0" scrolling="no" allowtransparency="true"></iframe></span>');


        return (/<("[^"]*"|'[^']*'|[^'">])*>/).test(embed_tag) ? embed_tag : false;
    };
    
    /**
     * Add html to page
     *
     * @param {string} html
     * @return {void}
     */

    Embeds.prototype.embed = function (html) {
        var $place = this.$el.find('.medium-insert-embeds-active');
        
        if (!html) {
            alert('Incorrect URL format specified');
            return false;
        } else {
            $place.after(this.templates['src/js/templates/embeds-wrapper.hbs']({
                html: html
            }));
            $place.remove();
            
            this.$el.trigger('keyup').trigger('input');

            if (html.indexOf("facebook") !== -1) {
                if (typeof(FB) !== 'undefined') {
                    setTimeout(function () { 
                        FB.XFBML.parse();
                    }, 2000);
                }
            }
        }
    };

    /** Plugin initialization */
    
    $.fn[pluginName + addonName] = function (options) {
        return this.each(function () {
            if (!$.data(this, 'plugin_' + pluginName + addonName)) {
                $.data(this, 'plugin_' + pluginName + addonName, new Embeds(this, options));
            }
        });
    };

})(jQuery, window, document);
/*global placeCaret, Blob */

module('images', {
    setup: function () {
        this.clock = sinon.useFakeTimers();

        $('#qunit-fixture').html('<div class="editable"></div>');
        this.$el = $('.editable');
        this.$el.mediumInsert();
        this.addon = this.$el.data('plugin_mediumInsertImages');

        // Place caret into first paragraph
        placeCaret(this.$el.find('p').get(0), 0);
    },
    teardown: function () {
        this.clock.restore();
    }
});

asyncTest('image preview', function () {
    var that = this;

    this.$el.find('p').click();

    this.addon.uploadAdd(null, {
        autoUpload: true,
        files: [new Blob([''], { type: 'image/jpeg' })],
        submit: function () {
            equal(that.$el.find('.medium-insert-images').length, 1, '.medium-insert-images div added');
            equal(that.$el.find('.medium-insert-images img').length, 1, 'image added');
            equal(that.$el.find('.medium-insert-images .medium-insert-images-progress').length, 1, 'progressbar added');
            ok(that.$el.find('.medium-insert-images img').attr('src').match(/^data:/), 'preview is displayed');
            start();
        },
        process: function () {
            return this;
        },
        done: function (callback) {
            callback();
        }
    });
});

test('image preview replaced by uploaded image', function () {
    var stubbedImage;
    stubbedImage = sinon.stub();
    sinon.stub(this.addon, 'getDOMImage').returns(stubbedImage);
    this.$el.prepend('<div class="medium-insert-images medium-insert-active">'+
        '<figure><img src="data:" alt=""></figure>'+
    '</div>');

    this.addon.uploadDone(null, {
        context: this.$el.find('figure'),
        result: {
            files: [
                { url: 'test.jpg' }
            ]
        }
    });
    stubbedImage.onload();
    equal(this.$el.find('.medium-insert-images img').attr('src'), 'test.jpg', 'preview replaced with uploaded image');
});

asyncTest('image upload without preview', function () {
    var that = this;

    this.addon.options.preview = false;
    this.$el.find('p').click();

    this.addon.uploadAdd(null, {
        autoUpload: true,
        files: [new Blob([''], { type: 'image/jpeg' })],
        submit: function () {
            equal(that.$el.find('.medium-insert-images').length, 1, '.medium-insert-images div added');
            equal(that.$el.find('.medium-insert-images progress').length, 1, 'progressbar added');
            equal(that.$el.find('.medium-insert-images img').length, 0, 'no preview displayed');

            that.addon.uploadDone(null, {
                result: {
                    files: [
                        { url: 'test.jpg' }
                    ]
                }
            });

            equal(that.$el.find('.medium-insert-images img').attr('src'), 'test.jpg', 'preview replaced with uploaded image');
            start();
        },
        process: function () {
            return this;
        },
        done: function (callback) {
            callback();
        }
    });
});

asyncTest('automatically adding grid when multiple images are in a set', function () {
    var that = this;

    this.addon.options.preview = false;
    this.$el.prepend('<div class="medium-insert-images medium-insert-active">'+
        '<figure></figure>'+
        '<figure></figure>'+
    '</div>');

    this.addon.uploadAdd(null, {
        autoUpload: true,
        files: [new Blob([''], { type: 'image/jpeg' })],
        submit: function () {
            that.addon.uploadDone(null, {
                result: {
                    files: [
                        { url: 'test.jpg' }
                    ]
                }
            });

            ok(that.$el.find('.medium-insert-images').hasClass('medium-insert-images-grid'), '.medium-insert-images-grid class added');
            start();
        },
        process: function () {
            return this;
        },
        done: function (callback) {
            callback();
        }
    });
});

asyncTest('not adding grid when not enough images are in a set', function () {
    var that = this;

    this.addon.options.preview = false;
    this.$el.prepend('<div class="medium-insert-images medium-insert-active">'+
        '<figure></figure>'+
    '</div>');

    this.addon.uploadAdd(null, {
        autoUpload: true,
        files: [new Blob([''], { type: 'image/jpeg' })],
        submit: function () {
            that.addon.uploadDone(null, {
                result: {
                    files: [
                        { url: 'test.jpg' }
                    ]
                }
            });

            equal(that.$el.find('.medium-insert-images').hasClass('medium-insert-images-grid'), false, '.medium-insert-images-grid class was not added');
            start();
        },
        process: function () {
            return this;
        },
        done: function (callback) {
            callback();
        }
    });
});

asyncTest('triggering input event on showImage', function () {
    this.$el.one('input', function () {
        ok(1, 'input triggered');
        start();
    });

    this.addon.showImage(null, {
        submit: function () {}
    });
});

asyncTest('triggering input event twice on showImage for preview', function (assert) {
    var that = this,
        inputTriggerCount = 0,
        stubbedImage,
        context;

    stubbedImage = sinon.stub();
    sinon.stub(this.addon, 'getDOMImage').returns(stubbedImage);
    context = this.$el.prepend('<div class="medium-insert-images medium-insert-active">'+
        '<figure><img src="data:" alt=""></figure>'+
    '</div>');

    assert.expect(2);
    this.$el.on('input', function () {
        if (inputTriggerCount === 0)
            start();
        if (inputTriggerCount === 2) {
            that.$el.off('input');
        } else {
            inputTriggerCount++;
        }
        ok(1, 'input triggered');
    });

    this.addon.showImage('http://image.co', {
        context: context
    });
    stubbedImage.onload();
});

test('selecting image', function () {
    this.$el.find('p')
        .addClass('medium-insert-images')
        .append('<figure><img src="image1.jpg" alt=""></figure>');

    this.$el.find('img').click();
    this.clock.tick(50);

    ok(this.$el.find('img').hasClass('medium-insert-image-active'), 'image is selected');
    ok($('.medium-insert-images-toolbar').length, 'image toolbar added');
    ok($('.medium-insert-images-toolbar2').length, '2nd toolbar added');
    ok(this.$el.find('figcaption').length, 'caption added');
});

test('disabling captions', function () {
    $('#qunit-fixture').html('<div class="editable"><div class="medium-insert-images"><figure><img src="image1.jpg" alt=""></figure></div></div>');
    this.$el = $('.editable');
    this.$el.mediumInsert({
        addons: {
            images: {
                captions: false
            }
        }
    });

    this.$el.find('img').click();
    this.clock.tick(50);

    equal(this.$el.find('figcaption').length, 0, 'caption was not added');
});

test('clicking on caption removes placeholder', function () {
    this.$el.find('p')
        .addClass('medium-insert-images')
        .append('<figure><img src="image1.jpg" alt="" class="medium-insert-image-active"><figcaption class="medium-insert-caption-placeholder"></figcaption></figure>');

    this.$el.find('.medium-insert-caption-placeholder').click();
    this.clock.tick(50);

    equal(this.$el.find('figcaption').hasClass('medium-insert-caption-placeholder'), false, 'caption placeholder removed');
});

test('unselecting image', function () {
    this.$el.find('p')
        .addClass('medium-insert-images')
        .append('<figure><img src="image1.jpg" alt="" class="medium-insert-image-active"><figcaption></figcaption></figure>');

    this.$el.click();

    equal(this.$el.find('img').hasClass('medium-insert-image-active'), false, 'image is unselected');
    equal($('.medium-insert-images-toolbar').length, 0, 'image toolbar removed');
    equal($('.medium-insert-images-toolbar2').length, 0, '2nd toolbar removed');
    equal(this.$el.find('figcaption').length, 0, 'caption removed');
});

test('removing image', function () {
    var $event = $.Event('keydown');

    $event.which = 8;

    this.$el.find('p')
        .addClass('medium-insert-images medium-insert-images-grid')
        .append('<figure><img src="image1.jpg" alt=""></figure>'+
            '<figure><img src="image2.jpg" alt=""></figure>'+
            '<figure><img src="image3.jpg" alt=""></figure>'+
            '<figure><img src="image4.jpg" alt="" class="medium-insert-image-active"></figure>');

    this.$el.trigger($event);

    equal(this.$el.find('img').length, 3, 'image deleted');
    equal(this.$el.find('.medium-insert-images').hasClass('medium-insert-images-grid'), true, '.medium-insert-images-grid class remains');

    this.$el.find('img').last().addClass('medium-insert-image-active');
    this.$el.trigger($event);

    equal(this.$el.find('img').length, 2, 'image deleted');

    this.$el.find('img').addClass('medium-insert-image-active');
    this.$el.trigger($event);

    equal(this.$el.find('.medium-insert-images').length, 0, 'whole .medium-insert-images was deleted');
    equal($('.medium-insert-images-toolbar').length, 0, 'image toolbar removed');
});

asyncTest('removing image triggers input event', function () {
   var $event = $.Event('keydown');

   this.$el.one('input', function () {
       ok(1, 'input triggered');
       start();
   });

   $event.which = 8;

   this.$el.find('p')
       .addClass('medium-insert-images')
       .append('<figure><img src="image1.jpg" alt=""></figure>'+
           '<figure><img src="image2.jpg" alt="" class="medium-insert-image-active"></figure>');

   this.$el.trigger($event);
});

asyncTest('deleting file', function () {
    var $event = $.Event('keydown');

    $event.which = 8;

    this.$el.find('p')
        .addClass('medium-insert-images')
        .append('<figure><img src="image1.jpg" alt=""></figure>'+
            '<figure><img src="image2.jpg" alt="" class="medium-insert-image-active"></figure>');

    this.stub(jQuery, 'post', function () {
       ok(1, 'ajax call created');
       jQuery.post.restore();
       start();
    });

    this.$el.trigger($event);
});

test('choosing image style', function () {
    var $p = this.$el.find('p')
        .attr('class', 'medium-insert-images medium-insert-active medium-insert-images-left')
        .append('<figure><img src="image1.jpg" alt=""></figure>');

    $p.find('img').click();
    this.clock.tick(50);

    $('.medium-insert-images-toolbar .medium-editor-action').first().click();

    ok($p.hasClass('medium-insert-images-wide'), 'image style added');
    equal($p.hasClass('medium-insert-images-left'), false, 'old style removed');
});

asyncTest('choosing image style triggers input event', function () {
    var $p = this.$el.find('p')
        .attr('class', 'medium-insert-images medium-insert-active medium-insert-images-left')
        .append('<figure><img src="image1.jpg" alt=""></figure>');

    this.$el.one('input', function () {
        ok(1, 'input triggered');
        start();
    });

    $p.find('img').click();
    this.clock.tick(50);

    $('.medium-insert-images-toolbar .medium-editor-action').first().click();
});

asyncTest('choosing image style calls callback function', function () {
    $('#qunit-fixture').html('<div class="editable"></div>');
    this.$el = $('.editable');

    this.$el.mediumInsert({
        addons: {
            images: {
                styles: {
                    wide: {
                        added: function () {
                            ok(1, 'callback function called');
                            start();
                        }
                    }
                }
            }
        }
    });

    this.$el.find('p')
        .addClass('medium-insert-images')
        .append('<figure><img src="image1.jpg" alt=""></figure>');

    // Place caret into first paragraph
    placeCaret(this.$el.find('p').get(0), 0);

    this.$el.find('img').click();
    this.clock.tick(50);

    $('.medium-insert-images-toolbar .medium-editor-action').first().click();
});

asyncTest('clicking image action calls callback function', function () {
    $('#qunit-fixture').html('<div class="editable"></div>');
    this.$el = $('.editable');

    this.$el.mediumInsert({
        addons: {
            images: {
                actions: {
                    remove: {
                        clicked: function () {
                            ok(1, 'callback function called');
                            start();
                        }
                    }
                }
            }
        }
    });

    this.$el.find('p')
        .addClass('medium-insert-images')
        .append('<figure><img src="image1.jpg" alt=""></figure>');

    // Place caret into first paragraph
    placeCaret(this.$el.find('p').get(0), 0);

    this.$el.find('img').click();
    this.clock.tick(50);

    $('.medium-insert-images-toolbar2 .medium-editor-action').first().click();
});

asyncTest('uploadDone calls uploadCompleted callback', function () {
    var that = this;

    $('#qunit-fixture').html('<div class="editable"></div>');
    this.$el = $('.editable');
    this.$el.mediumInsert({
        addons: {
            images: {
                uploadCompleted: function () {
                    ok(1, 'uploadCompleted callback called');
                    start();
                }
            }
        }
    });
    this.addon = this.$el.data('plugin_mediumInsertImages');


    this.stub(this.addon, 'showImage', function () {
        that.addon.showImage.restore();
    });

    this.addon.uploadDone(null, {
        result: {
            files: [
                { url: 'test.jpg' }
            ]
        }
    });
});

test('contentediable attr are added on initialization', function () {
    $('#qunit-fixture').html('<div class="editable"><div class="medium-insert-images"><figure><img src="image1.jpg" alt=""><figcaption></figcaption></figure></div></div>');
    this.$el = $('.editable');

    this.$el.mediumInsert({
        addons: {
            images: {}
        }
    });

    equal(this.$el.find('.medium-insert-images figure').attr('contenteditable'), 'false', 'contenteditable attr was added to figure');
    equal(this.$el.find('.medium-insert-images figcaption').attr('contenteditable'), 'true', 'contenteditable attr was added to figcaption');
});

/* THESE TESTS FOR SOME REASON DON'T WORK IN PHANTOMJS

test('editor\'s serialize removes also contenteditable attr', function () {
    var html = '<div class="medium-insert-images"><figure><img src="image1.jpg" alt=""></figure></div><p><br></p>',
        editor;

    $('#qunit-fixture').html('<div class="editable">'+ html +'</div>');
    this.$el = $('.editable');

    editor = new MediumEditor(this.$el.get(0));

    this.$el.mediumInsert({
        editor: editor,
        addons: {
            images: {}
        }
    });

    equal(editor.serialize()['element-0'].value, html, 'contenteditable attr were removed');
});


asyncTest('file type validation', function () {
    sinon.stub(window, 'alert', function (text) {
        ok(text.match(/^This file is not in a supported format/), 'alert was displayed');
        window.alert.restore();
        start();
        return false;
    });

    this.$el.find('p').click();

    this.addon.uploadAdd(null, {
        files: [{ type: 'application/json' }]
    });
});

asyncTest('file size validation', function () {
    $('#qunit-fixture').html('<div class="editable"></div>');
    this.$el = $('.editable');
    this.$el.mediumInsert({
        addons: {
            images: {
                fileUploadOptions: {
                    maxFileSize: 1000
                }
            }
        }
    });
    this.addon = this.$el.data('plugin_mediumInsertImages');

    sinon.stub(window, 'alert', function (text) {
        ok(text.match(/^This file is too big/), 'alert was displayed');
        window.alert.restore();
        start();
        return false;
    });

    this.$el.find('p').click();

    this.addon.uploadAdd(null, {
        files: [{ type: 'image/jpeg', size: 1001 }]
    });
});
*/